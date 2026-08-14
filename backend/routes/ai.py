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
    hint_text = f"Konteks foto: {hint}. " if hint else ""
    system = (
        "You are a strict counting assistant for water gallons (galon 19 liter) in a photo. "
        "Return ONLY a valid JSON object with this schema and nothing else: "
        '{"count": <integer>, "confidence": "low"|"medium"|"high", "reasoning": "<short reason in Bahasa Indonesia, max 200 chars>"}. '
        "Rules: count only visible gallon containers. If some are stacked/occluded, estimate "
        "and set confidence accordingly. If image is unclear or has no gallons, count=0 confidence=low."
    )
    user_prompt = (
        hint_text
        + "Berapa jumlah galon air yang terlihat di foto ini? "
        + 'Balas HANYA JSON: {"count": N, "confidence": "high|medium|low", "reasoning": "..."}'
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
    reasoning = str(parsed.get("reasoning") or "")[:200]
    return {"count": max(0, count), "confidence": conf, "reasoning": reasoning}
