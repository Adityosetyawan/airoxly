"""AI Vision — count gallons in a photo (GPT-5 via Emergent LLM key)."""
from __future__ import annotations

import json as _json
import logging
import os
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from core.security import get_current_user
from models import AICountRequest

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/count-gallons")
async def ai_count_gallons(body: AICountRequest, user=Depends(get_current_user)):
    """Count water gallons in a photo using GPT-5 Vision (Emergent LLM key).

    Response: { count, confidence, reasoning }.
    """
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

    hint = (body.hint or "").strip().lower()
    hint_text = f"Konteks foto: {hint}. " if hint else ""
    system = (
        "You are a strict counting assistant for water gallons (galon 19 liter) in a photo. "
        "Return ONLY a valid JSON object with this schema and nothing else: "
        '{"count": <integer>, "confidence": "low"|"medium"|"high", "reasoning": "<short reason>"}. '
        "Rules: count only visible gallon containers. If some are stacked/occluded, estimate "
        "and set confidence accordingly. If image is unclear or has no gallons, count=0 confidence=low."
    )
    user_prompt = (
        hint_text
        + "Berapa jumlah galon air yang terlihat di foto ini? "
        + 'Balas hanya JSON: {"count": N, "confidence": "high|medium|low", "reasoning": "..."}'
    )

    try:
        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"count-gallons-{user['id']}-{int(datetime.now().timestamp())}",
            system_message=system,
        ).with_model("openai", "gpt-5")
        image_content = ImageContent(image_base64=img_raw)
        reply = await chat.send_message(UserMessage(text=user_prompt, file_contents=[image_content]))
    except Exception as e:
        logging.exception("AI vision failed")
        raise HTTPException(502, f"AI vision gagal: {e}")

    txt = (reply or "").strip()
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
