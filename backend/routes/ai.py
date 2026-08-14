"""AI Vision — count gallons in a photo (GPT-5.4 via Emergent LLM key).

Robustness features:
- Retries once with a fallback model if the primary fails.
- Compresses/resizes very large images to avoid provider timeout.
- Surfaces the real error string so operators can diagnose.
- Exposes a lightweight `/api/ai/health` for quick production verification.
"""
from __future__ import annotations

import base64
import io
import json as _json
import logging
import os
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from core.security import get_current_user
from models import AICountRequest

router = APIRouter(prefix="/api/ai", tags=["ai"])

# Primary + fallback vision models (June 2026 recommended list)
PRIMARY_MODEL = ("openai", "gpt-5.4")
FALLBACK_MODEL = ("openai", "gpt-5.4-mini")

# If the base64 payload is bigger than this, we try to shrink it via Pillow.
MAX_BASE64_BYTES = 1_400_000  # ~1MB image after base64 (LLM providers slow > 1-2MB)


def _shrink_if_needed(b64: str) -> str:
    """Downscale huge images so upstream call stays quick.

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
        max_side = 1280
        w, h = img.size
        if max(w, h) > max_side:
            scale = max_side / float(max(w, h))
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=78, optimize=True)
        return base64.b64encode(out.getvalue()).decode()
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
        "primary_model": f"{PRIMARY_MODEL[0]}/{PRIMARY_MODEL[1]}",
        "fallback_model": f"{FALLBACK_MODEL[0]}/{FALLBACK_MODEL[1]}",
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
        "Anda adalah asisten hitung galon air 19-liter (diameter ~28 cm, tinggi ~48 cm) yang teliti. "
        "Analisis foto lalu terapkan salah satu strategi berikut sesuai kondisi galon:\n\n"

        "STRATEGI A — Galon terpisah / satu lapis di lantai/rak (mudah dilihat semua):\n"
        "  Hitung langsung setiap galon yang terlihat.\n"
        "  Confidence: HIGH kalau semua terlihat jelas, MEDIUM kalau ada beberapa terpotong bingkai.\n\n"

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

        "STRATEGI C — Galon DI ATAS MOBIL / TRUK / PICKUP:\n"
        "  1. Identifikasi jenis kendaraan dan estimasi dimensi bak muatan:\n"
        "     • Pickup kecil (Carry, Grandmax, APV pickup) bak ~2.4 m × 1.5 m\n"
        "     • Pickup sedang (Hilux, Triton, L300) bak ~2.4 m × 1.6 m\n"
        "     • Truk engkel colt diesel bak ~3.5–4 m × 1.7 m\n"
        "     • Truk fuso bak ~5–6 m × 2.0 m\n"
        "  2. Kalau galon berdiri tegak: per m² muat ~10 galon (dgn diameter 28 cm) → total per lapisan ≈ luas bak × 10.\n"
        "     Contoh: bak 2.4×1.5 = 3.6 m² → ~36 galon per lapisan (mendekati 5×7 = 35).\n"
        "  3. Kalau galon direbahkan/miring: kurang-lebih SAMA jumlahnya karena diameter tetap dominan.\n"
        "  4. Hitung berapa lapisan galon tinggi di bak (lihat dari samping / dari galon yang menyembul di pinggir).\n"
        "  5. Rumus: TOTAL = galon_per_lapisan × jumlah_lapisan. Kurangi ~10-15% bila ada rongga di tengah.\n"
        "  6. Bila galon disusun rapi menutupi seluruh bak tanpa rongga → confidence MEDIUM.\n"
        "     Bila banyak galon tersembunyi di tengah dan tidak jelas → confidence LOW.\n\n"

        "ATURAN OUTPUT (WAJIB):\n"
        "  - Kembalikan HANYA JSON (tanpa markdown, tanpa penjelasan tambahan sebelum/sesudah).\n"
        "  - Schema: {\"count\": <integer>, \"confidence\": \"low\"|\"medium\"|\"high\", \"reasoning\": \"<Bahasa Indonesia, max 220 karakter, WAJIB tuliskan cara hitung: strategi mana yang dipakai + angka P×L×T atau dimensi mobil>\"}\n"
        "  - Reasoning WAJIB menyebut angka konkret: mis. \"Strategi B: dasar 5×4=20, tinggi 3 lapis → total 60 galon\" atau \"Strategi C: pickup Carry bak 2.4×1.5, 30 galon/lapis × 2 lapis = 60\".\n"
        "  - PENTING BANGET: field `count` HARUS = hasil PENJUMLAHAN semua sub-layer / rumus, BUKAN estimasi visual/impresi. Kalau formula memberi 55, count = 55 (jangan turunkan jadi 23 karena \"kelihatannya\").\n"
        "  - Jangan ada frasa seperti \"tampak efektif\", \"kelihatan hanya\", \"visual estimate\" — count = hasil aritmatika akhir.\n"
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
    for attempt, (provider, model) in enumerate([PRIMARY_MODEL, FALLBACK_MODEL], start=1):
        try:
            reply = await _call_vision(LlmChat, UserMessage, ImageContent, provider, model, emergent_key, session_id, system, user_prompt, img_raw)
            if reply:
                break
        except Exception as e:  # noqa: BLE001
            last_err = e
            logging.warning("AI vision attempt %d (%s/%s) failed: %s", attempt, provider, model, e)
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
    reasoning = str(parsed.get("reasoning") or "")[:220]

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
    except Exception as _e:  # noqa: BLE001
        pass

    return {"count": max(0, count), "confidence": conf, "reasoning": reasoning}
