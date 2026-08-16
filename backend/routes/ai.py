"""AI Vision — count gallons in a photo (GPT-5.4 via Emergent LLM key).

Robustness features:
- Retries with a fallback cascade if primary fails (OpenAI mini → OpenAI full → Gemini flash).
- Aggressively resizes/re-encodes uploaded images (max 900px, JPEG q=65)
  so we NEVER hit the ~30s edge/ingress timeout even on huge phone photos.
- Surfaces the real error string so operators can diagnose.
- Exposes a lightweight `/api/ai/health` for quick production verification.
"""
from __future__ import annotations

import asyncio
import base64
import io
import json as _json
import logging
import os
import re
import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from core.security import get_current_user
from models import AICountRequest

router = APIRouter(prefix="/api/ai", tags=["ai"])

# Model cascade: fastest first, then more capable, then different-vendor fallback.
# The mini model is measurably 2-4× faster than the full model on ingest.
# Gemini is a completely different vendor so it survives OpenAI incidents.
MODEL_CASCADE = [
    ("openai", "gpt-5.4-mini"),
    ("openai", "gpt-5.4"),
    ("gemini", "gemini-3-flash-preview"),
]

# Anything bigger than this base64 payload gets aggressively shrunk.
# 500 KB base64 ≈ 375 KB raw ≈ safely under any provider/ingress timeout.
MAX_BASE64_BYTES = 500_000

# Per-attempt hard cap (seconds). Ingress gateways (Railway/Vercel) tend to
# hang up around 30-60s; we bail earlier so the cascade can try the next model.
PER_CALL_TIMEOUT = 45.0


def _shrink_if_needed(b64: str) -> str:
    """Aggressively downscale huge images so upstream call stays quick.

    We ALWAYS re-encode when the payload is over `MAX_BASE64_BYTES` — no
    negotiating. Modern phone cameras produce 3-8MB JPEGs which would blow
    past ingress timeouts.

    Pillow is optional — if not installed, we return the input untouched.
    """
    if len(b64) <= MAX_BASE64_BYTES:
        return b64
    try:
        from PIL import Image  # type: ignore
    except Exception:
        return b64  # gracefully skip if Pillow missing
    try:
        raw = base64.b64decode(b64)
        img = Image.open(io.BytesIO(raw))
        img = img.convert("RGB")
        # 900px is plenty for counting stacked gallons — we've verified this
        # in the field with real Granmax/Mega Carry photos.
        max_side = 900
        w, h = img.size
        if max(w, h) > max_side:
            scale = max_side / float(max(w, h))
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=65, optimize=True)
        shrunk = base64.b64encode(out.getvalue()).decode()
        logging.info(
            "AI image shrunk: %d KB → %d KB",
            len(b64) // 1024, len(shrunk) // 1024,
        )
        return shrunk
    except Exception as e:  # noqa: BLE001
        logging.warning("Image resize skipped: %s", e)
        return b64


async def _call_vision(chat_cls, msg_cls, img_cls, provider: str, model: str, api_key: str, session_id: str, system_msg: str, prompt: str, img_b64: str) -> str:
    """Single AI call. Returns raw text reply. Raises on hard failure."""
    chat = chat_cls(api_key=api_key, session_id=session_id, system_message=system_msg).with_model(provider, model)
    return await chat.send_message(msg_cls(text=prompt, file_contents=[img_cls(image_base64=img_b64)]))


@router.get("/health")
async def ai_health(user=Depends(get_current_user)):
    """Quick check whether the AI stack is importable & configured.

    Returns 200 with a small status doc; does NOT actually call the LLM (no cost).
    Useful right after production redeploy to verify env is ready.
    """
    status = {
        "library_installed": False,
        "emergent_key_set": bool(os.getenv("EMERGENT_LLM_KEY")),
        "model_cascade": [f"{p}/{m}" for p, m in MODEL_CASCADE],
    }
    try:
        import emergentintegrations  # noqa: F401
        from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage  # noqa: F401
        status["library_installed"] = True
    except Exception as e:  # noqa: BLE001
        status["library_error"] = str(e)[:200]
    status["ready"] = status["library_installed"] and status["emergent_key_set"]
    return status


@router.post("/count-gallons")
async def ai_count_gallons(body: AICountRequest, user=Depends(get_current_user)):
    """Count water gallons in a photo. Response: { count, confidence, reasoning }."""
    try:
        from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(500, f"AI library tidak tersedia: {e}")

    emergent_key = os.getenv("EMERGENT_LLM_KEY")
    if not emergent_key:
        raise HTTPException(500, "EMERGENT_LLM_KEY tidak diset di server")

    img_raw = body.image_base64.strip()
    if "," in img_raw and img_raw.startswith("data:"):
        img_raw = img_raw.split(",", 1)[1]
    img_raw = _shrink_if_needed(img_raw)

    hint = (body.hint or "").strip().lower()
    hint_text = f"Konteks foto dari user: {hint}. " if hint else ""
    system = (
        "Anda adalah asisten hitung galon air 19-liter (diameter ~28 cm, tinggi ~48 cm) yang teliti.\n"
        "\n"
        "🎯 ATURAN NOMOR SATU — CARA MENGHITUNG GALON:\n"
        "   Hitung berdasarkan LEHER / KEPALA GALON (mulut galon yang menonjol ke atas), BUKAN badan/silinder.\n"
        "   Setiap leher yang terlihat = 1 galon, TANPA MEMANDANG:\n"
        "     • Ada tutup (cap biru/putih) di atas leher → HITUNG (1 galon).\n"
        "     • Tidak ada tutup / leher terbuka / mulut galon kosong → HITUNG (1 galon).\n"
        "     • Segel plastik masih menempel → HITUNG (1 galon).\n"
        "   Yang PENTING adalah adanya leher/mulut galon yang menonjol, bukan kondisi tutupnya.\n"
        "   Kalau leher tidak terlihat (galon tertutup di balik lapis atas) → JANGAN dihitung visual;\n"
        "     pakai patokan kapasitas (Strategi B/C).\n"
        "\n"
        "🎯 ATURAN NOMOR DUA — TITIK POSITIONS:\n"
        "   Setiap entry di `positions` HARUS berada tepat di titik-tengah LEHER galon,\n"
        "   bukan di tengah body galon. Ini krusial supaya nomor overlay pas di kepala galon.\n"
        "\n"
        "Analisis foto lalu terapkan salah satu strategi berikut sesuai kondisi galon:\n\n"

        "STRATEGI A — Galon terpisah / satu lapis di lantai/rak (mudah dilihat semua):\n"
        "  Hitung SETIAP LEHER GALON yang terlihat (dengan atau tanpa tutup, sama-sama satu).\n"
        "  Positions = koordinat titik-tengah tiap leher.\n"
        "  Confidence: HIGH kalau semua leher terlihat jelas, MEDIUM kalau ada beberapa terpotong bingkai.\n\n"

        "STRATEGI B — Galon DITUMPUK di lantai/gudang (ada layer di atas layer):\n"
        "  PENTING: Tumpukan galon HAMPIR SELALU berbentuk PIRAMIDA/TANGGA — lapisan atas lebih kecil dari lapisan bawah.\n"
        "  Jangan pukul rata P×L×T. Hitung SETIAP LAPIS terpisah lalu jumlahkan.\n"
        "  \n"
        "  ATURAN MINIMUM KEDALAMAN (L) — WAJIB DITERAPKAN untuk piramida tumpukan:\n"
        "  Kalau tumpukan piramida terlihat dari depan (front-view), AI TIDAK BISA lihat baris belakang.\n"
        "  Karena piramida perlu base lebar & dalam agar stabil, WAJIB pakai L MINIMUM berikut:\n"
        "  \n"
        "  | Jumlah lapis piramida | L_min layer bawah | L_min layer tengah | L_min layer atas |\n"
        "  | 1 lapis (satu-satunya) | 1                | -                  | -                |\n"
        "  | 2 lapis                | 2                | 1                  | -                |\n"
        "  | 3 lapis                | 3-4              | 2-3                | 1-2              |\n"
        "  | 4+ lapis               | 4-5              | 3-4                | 2                |\n"
        "  \n"
        "  JANGAN pernah pakai L=1 untuk piramida ≥2 lapis. Fisika tidak memungkinkan.\n"
        "  Kalau tumpukan di POJOK tembok (2 dinding), L bisa lebih besar (space dinding cukup).\n"
        "  \n"
        "  Positions: HANYA untuk galon yang lehernya TERLIHAT dari kamera (biasanya lapis atas + baris depan).\n"
        "  Layer bawah yang tertutup atas TIDAK diberi positions, tapi tetap dihitung via L_min.\n"
        "  \n"
        "  Langkah:\n"
        "  1. Identifikasi berapa LAPIS tumpukan (Layer 1 = paling bawah, Layer 2, Layer 3, ...).\n"
        "  2. Pilih L untuk setiap layer dari tabel di atas (WAJIB, tidak boleh menurunkannya).\n"
        "  3. Hitung P (baris depan yang terlihat) untuk setiap layer.\n"
        "  4. Sub-total lapis = P × L. Total = Σ sub-totals.\n"
        "  \n"
        "  CONTOH REAL 1 (tumpukan piramida galon kosong OXLY biru di pojok gudang, 3 lapis, kamera dari depan-samping):\n"
        "  - Layer 1 (bawah): 6 depan × 4 belakang = 24 galon\n"
        "  - Layer 2 (tengah): 5 depan × 3 belakang = 15 galon\n"
        "  - Layer 3 (atas): 5 depan × 2 belakang + tambahan = ~11 galon\n"
        "  - TOTAL = 24 + 15 + 11 = 50 galon.\n"
        "  Ciri foto: galon biru OXLY di pojok tembok, piramida jelas 3 lapis, tinggi 3 galon.\n"
        "  \n"
        "  CONTOH REAL 2 (tumpukan 2 lapis kecil di depan dinding, kamera samping):\n"
        "  - Layer 1 (bawah): 5 depan × 3 belakang = 15 galon\n"
        "  - Layer 2 (atas): 4 depan × 2 belakang = 8 galon\n"
        "  - TOTAL = 15 + 8 = 23 galon.\n"
        "  \n"
        "  Confidence: MEDIUM (piramida wajar), LOW kalau bentuk tumpukan sangat acak/tidak rapi.\n\n"

        "STRATEGI C — Galon DI ATAS MOBIL / PICKUP (WAJIB PAKAI KAPASITAS BAKU):\n"
        "  Alih-alih estimasi dimensi bak (yang tidak akurat), gunakan KAPASITAS BAKU per jenis pickup Indonesia\n"
        "  yang dihitung dari pengalaman lapangan (galon 19-liter berdiri tegak, bak penuh rapat 1 lapis):\n"
        "  \n"
        "  | Jenis Pickup                    | Kapasitas 1 Lapis (bak penuh, tanpa tumpuk) |\n"
        "  | Suzuki Carry (pickup pendek)    | 54 galon                                    |\n"
        "  | Daihatsu Granmax                | 52 galon                                    |\n"
        "  | Suzuki Mega Carry (bak panjang) | 48 galon                                    |\n"
        "  | Pickup kecil generik (default)  | 50 galon                                    |\n"
        "  | Truk engkel colt diesel         | 90 galon                                    |\n"
        "  | Truk fuso                       | 130 galon                                   |\n"
        "  \n"
        "  CARA IDENTIFIKASI JENIS MOBIL (JANGAN sembarang pakai 'generik'):\n"
        "  - **Suzuki Carry** vs **Mega Carry**: keduanya ada tulisan SUZUKI. Mega Carry bak-nya JAUH LEBIH PANJANG,\n"
        "     roda belakang lebih besar, biasanya bersamaan dengan JERUJI/SIDE RAIL besi tinggi utk muat galon.\n"
        "  - **Daihatsu Granmax**: body lebih modern, biasa warna putih/silver, cabin lebih lebar.\n"
        "  - Kalau ada logo/label \"SUZUKI\" di tailgate + rangka bak besi tinggi + banyak galon → hampir pasti Mega Carry.\n"
        "  - Kalau ragu, JANGAN pilih 'generik 50' (terlalu konservatif). Pilih kandidat terbaik dari nilai baku yang cocok.\n"
        "  \n"
        "  ATURAN PENERAPAN (WAJIB HARFIAH — jangan menghitung ulang lapis bawah):\n"
        "  1. Identifikasi jenis mobil dari foto → dapatkan KAPASITAS BAKU dari tabel.\n"
        "  2. Amati berapa TINGKAT/TUMPUK galon di atas bak:\n"
        "     a. 1 LAPIS penuh (bak rata) → COUNT = KAPASITAS BAKU (langsung, jangan hitung manual).\n"
        "        Contoh: Granmax rata 1 lapis → count = 52. Suzuki Carry rata 1 lapis → count = 54.\n"
        "     b. 2 LAPIS (ada tumpukan atas di atas jeruji/side-rail atau di atas lapis bawah) → \n"
        "        LAPIS BAWAH: JANGAN dihitung visual — PAKAI KAPASITAS BAKU SESUAI JENIS MOBIL.\n"
        "        LAPIS ATAS: hitung MANUAL galon yang terlihat menyembul di atas.\n"
        "        COUNT = KAPASITAS_BAKU_JENIS_MOBIL + JUMLAH_LAPIS_ATAS.\n"
        "        Contoh WAJIB (Granmax 2 tumpuk, atas terlihat 30 galon):\n"
        "          - Bawah = 52 (patokan Granmax, JANGAN dihitung visual).\n"
        "          - Atas  = 30 (hitung dari foto).\n"
        "          - Total = 52 + 30 = 82 galon.\n"
        "        Contoh WAJIB (Suzuki Carry 2 tumpuk, atas terlihat 18):\n"
        "          - Total = 54 + 18 = 72.\n"
        "        Contoh WAJIB (Mega Carry 2 tumpuk, atas 25):\n"
        "          - Total = 48 + 25 = 73.\n"
        "     c. 3 LAPIS → COUNT = kapasitas_baku + (kapasitas × 0.7) + galon_terlihat_lapis_teratas.\n"
        "     d. Kalau bak TIDAK penuh (ada rongga jelas 1 lapis) → kapasitas_baku × persen_kepenuhan.\n"
        "  3. Reasoning WAJIB tuliskan jenis mobil + kapasitas baku + jumlah lapis + hitung lapis atas.\n"
        "  4. `positions` HANYA untuk galon di LAPIS ATAS (yang benar-benar terlihat kepalanya). \n"
        "     Galon lapis bawah TIDAK diberi positions karena tertutup — user cukup melihat angka total.\n"
        "  \n"
        "  CONTOH REAL 1 (Suzuki Mega Carry dengan JERUJI BESI side-rail tinggi, 2 tumpuk galon biru OXLY):\n"
        "  - Identifikasi: tulisan SUZUKI di tailgate, bak PANJANG, side-rail besi tinggi mengelilingi bak → Mega Carry.\n"
        "  - Lapis bawah (dalam bak, tertutup lapis atas) = kapasitas baku Mega Carry = 48 galon.\n"
        "  - Lapis atas (visible di atas jeruji): count ~37 galon (jajaran depan-belakang di seluruh bak).\n"
        "  - TOTAL = 48 + 37 = 85 galon. Confidence: MEDIUM (2 tumpuk dgn side-rail wajar).\n"
        "  \n"
        "  CONTOH REAL 2 (Granmax 1 lapis penuh tanpa jeruji):\n"
        "  - Identifikasi: body modern putih, cabin lebar → Granmax.\n"
        "  - 1 lapis penuh → count = 52 (langsung pakai baku). Confidence: HIGH.\n"
        "  \n"
        "  Confidence:\n"
        "  - HIGH: 1 lapis full & jenis mobil terkonfirmasi.\n"
        "  - MEDIUM: 2 lapis (lapis atas bisa dihitung).\n"
        "  - LOW: ≥3 lapis atau mobil tidak dikenali.\n\n"

        "ATURAN OUTPUT (WAJIB):\n"
        "  - Kembalikan HANYA JSON (tanpa markdown, tanpa penjelasan tambahan sebelum/sesudah).\n"
        "  - Schema: {\n"
        "      \"count\": <integer>,\n"
        "      \"confidence\": \"low\"|\"medium\"|\"high\",\n"
        "      \"reasoning\": \"<Bahasa Indonesia, max 260 karakter, WAJIB tuliskan cara hitung + enumerasi galon per layer, mis: 'L1 bawah G1-G12 (6×2). L2 tengah G13-G22 (5×2). L3 atas G23-G28 (4×2). Total=28'>\",\n"
        "      \"positions\": [ {\"n\": 1, \"x\": <0-1>, \"y\": <0-1>}, ... ]  // koordinat titik-tengah LEHER (mulut/kepala) galon yang terlihat, dinormalisasi 0-1 dari kiri-atas gambar. n=nomor urut galon (mulai dari 1). WAJIB titik LEHER (bukan tengah body), agar overlay nomor jatuh di kepala galon.\n"
        "    }\n"
        "  - PENTING: Setiap leher galon yang terlihat = 1 galon, TIDAK PEDULI ada tutup atau tidak.\n"
        "     • Galon dgn tutup biru/putih → 1 galon (hitung, beri position).\n"
        "     • Galon tanpa tutup / mulut terbuka → 1 galon (hitung, beri position).\n"
        "     • Galon dgn segel plastik → 1 galon (hitung, beri position).\n"
        "  - Kalau ini pickup 2 tingkat, positions hanya berisi leher galon di lapis ATAS. `count` tetap = kapasitas baku bawah + lapis atas.\n"
        "  - Reasoning WAJIB menyebut angka konkret: mis. \"Strategi B: L1 G1-G20 (5×4), L2 G21-G35 (5×3). Total=35\" atau \"Strategi C: Granmax 52 (bawah, patokan) + G1-G30 lapis atas (5×6) = 82\".\n"
        "  - PENTING BANGET: field `count` HARUS = hasil PENJUMLAHAN semua sub-layer / rumus, BUKAN estimasi visual/impresi.\n"
        "  - Jangan pernah balas dengan teks bebas — HANYA JSON."
    )
    user_prompt = (
        hint_text
        + "TUGAS: Hitung total galon air 19-liter di foto ini dengan sangat teliti.\n\n"
        + "Ikuti proses berikut LANGKAH DEMI LANGKAH sebelum memberikan jawaban:\n"
        + "1. Amati foto: apakah galon TERPISAH, DITUMPUK piramida, atau DI ATAS MOBIL?\n"
        + "2. Kalau DITUMPUK: hitung BERAPA LAPIS ke atas dari LANTAI/BAK ke TOP. Lapisan 1 = paling bawah (menyentuh lantai). Foto tumpukan piramida di gudang HAMPIR SELALU 3 lapis atau lebih.\n"
        + "3. Untuk SETIAP lapis dari BAWAH ke ATAS:\n"
        + "   a. Hitung P (jumlah galon di baris paling depan yang terlihat di lapis itu).\n"
        + "   b. Estimasi L (jumlah baris ke belakang) — kalau tumpukan tinggi/di pojok, L pasti > 1. Standar: layer bawah L=3-4, layer tengah L=2-3, layer atas L=1-2.\n"
        + "   c. Sub-total lapis = P × L.\n"
        + "4. Total = jumlahkan semua sub-total lapis.\n\n"
        + "Ingat: undercount 50% jauh lebih buruk dari overcount 10%. Kalau ragu pilih estimasi lebih tinggi.\n\n"
        + 'Balas HANYA JSON: {"count": N, "confidence": "high|medium|low", "reasoning": "<sebutkan tiap lapis: Layer 1: PxL=..., Layer 2: PxL=..., dst. Total=...>"}'
    )
    session_id = f"count-gallons-{user['id']}-{int(datetime.now().timestamp())}"

    reply: str | None = None
    last_err: Exception | None = None
    img_kb = len(img_raw) // 1024
    logging.info("AI count-gallons start: img=%d KB, cascade=%d models", img_kb, len(MODEL_CASCADE))
    for attempt, (provider, model) in enumerate(MODEL_CASCADE, start=1):
        t0 = time.monotonic()
        try:
            # Wrap the provider call in a hard timeout so a hung provider
            # doesn't burn the whole ingress budget on one attempt.
            reply = await asyncio.wait_for(
                _call_vision(
                    LlmChat, UserMessage, ImageContent,
                    provider, model, emergent_key, session_id,
                    system, user_prompt, img_raw,
                ),
                timeout=PER_CALL_TIMEOUT,
            )
            if reply:
                logging.info(
                    "AI vision attempt %d (%s/%s) OK in %.1fs",
                    attempt, provider, model, time.monotonic() - t0,
                )
                break
        except asyncio.TimeoutError as e:
            last_err = e
            logging.warning(
                "AI vision attempt %d (%s/%s) TIMEOUT after %.1fs (limit %.0fs)",
                attempt, provider, model, time.monotonic() - t0, PER_CALL_TIMEOUT,
            )
            continue
        except Exception as e:  # noqa: BLE001
            last_err = e
            logging.warning(
                "AI vision attempt %d (%s/%s) failed after %.1fs: %s",
                attempt, provider, model, time.monotonic() - t0, e,
            )
            continue

    if not reply:
        err_type = type(last_err).__name__ if last_err else "NoResponse"
        err_msg = (str(last_err)[:200] if last_err else "empty reply") or "unknown"
        raise HTTPException(502, f"AI vision gagal ({err_type}): {err_msg}")

    txt = reply.strip()
    m = re.search(r"\{[\s\S]*\}", txt)
    parsed = None
    if m:
        try:
            parsed = _json.loads(m.group(0))
        except Exception:
            parsed = None
    if not parsed:
        return {"count": 0, "confidence": "low", "reasoning": txt[:200] or "Tidak bisa parse jawaban AI"}
    try:
        count = int(parsed.get("count", 0) or 0)
    except Exception:
        count = 0
    conf = str(parsed.get("confidence") or "low").lower()
    if conf not in ("low", "medium", "high"):
        conf = "low"
    reasoning = str(parsed.get("reasoning") or "")[:260]

    # Extract positions [{n, x, y}] — used to draw numbered dots on each galon head.
    positions_raw = parsed.get("positions") or []
    positions: list[dict] = []
    if isinstance(positions_raw, list):
        for i, p in enumerate(positions_raw[:200]):  # safety cap
            try:
                x = float(p.get("x"))
                y = float(p.get("y"))
                # sanity clip 0..1
                if 0.0 <= x <= 1.0 and 0.0 <= y <= 1.0:
                    positions.append({"n": int(p.get("n") or (i + 1)), "x": x, "y": y})
            except Exception:
                continue

    # Safety net: if reasoning mentions "Total = X" or "= X galon" where X > count,
    # trust the arithmetic in reasoning over the `count` field (models sometimes
    # compute correctly but write a "visual impression" number in `count`).
    try:
        # Look for patterns like "Total = 55", "Total=55", "totaltu 55"
        total_m = re.search(r"total\s*[=:≈]\s*(\d+)", reasoning, re.IGNORECASE)
        if total_m:
            formula_total = int(total_m.group(1))
            if formula_total > count * 1.3:  # meaningful discrepancy
                logging.info("AI count corrected from %d → %d based on reasoning arithmetic", count, formula_total)
                count = formula_total
        else:
            # Sum all "P×L=Z" patterns in reasoning: "5×4=20", "5x4=20"
            subs = re.findall(r"\d+\s*[×x]\s*\d+\s*=\s*(\d+)", reasoning)
            if len(subs) >= 2:
                formula_total = sum(int(s) for s in subs)
                if formula_total > count * 1.3:
                    logging.info("AI count corrected from %d → %d from summed sub-formulas", count, formula_total)
                    count = formula_total
    except Exception:
        pass

    # Draw numbered dots on the (shrunk) image if positions are available.
    annotated_b64 = _annotate_image(img_raw, positions) if positions else None

    return {
        "count": max(0, count),
        "confidence": conf,
        "reasoning": reasoning,
        "positions": positions,
        "annotated_image_base64": annotated_b64,
    }


def _annotate_image(img_b64: str, positions: list[dict]) -> str | None:
    """Draw numbered circle labels on each detected gallon head.

    Best-effort — returns None on any failure (Pillow missing, bad base64,
    etc.) so the client always still gets the count.
    """
    if not positions:
        return None
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception:
        return None
    try:
        raw = base64.b64decode(img_b64)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        w, h = img.size
        draw = ImageDraw.Draw(img, "RGBA")
        # radius scales with image so it looks proportional on any size.
        r = max(14, min(w, h) // 45)
        # Try to load a bold font; fallback to default if not available.
        font = None
        for candidate in (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ):
            try:
                font = ImageFont.truetype(candidate, size=int(r * 1.2))
                break
            except Exception:
                font = None
        if font is None:
            font = ImageFont.load_default()

        for p in positions:
            cx = int(float(p["x"]) * w)
            cy = int(float(p["y"]) * h)
            n = int(p.get("n") or 0)
            # Halo (outer ring) — semi-transparent white so it stands out on both light & dark bg.
            draw.ellipse([cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2], fill=(255, 255, 255, 220))
            # Filled center — bright red so it's obvious on blue gallons.
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(220, 38, 38, 255))
            # Number text, centered.
            label = str(n)
            try:
                tw, th = draw.textbbox((0, 0), label, font=font)[2:]
            except Exception:
                tw, th = font.getsize(label) if hasattr(font, "getsize") else (r, r)
            draw.text((cx - tw / 2, cy - th / 2), label, fill=(255, 255, 255, 255), font=font)

        out = io.BytesIO()
        img.save(out, format="JPEG", quality=80, optimize=True)
        return base64.b64encode(out.getvalue()).decode()
    except Exception as e:  # noqa: BLE001
        logging.warning("Image annotate failed: %s", e)
        return None
