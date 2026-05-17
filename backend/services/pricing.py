import json
import logging
import os
import re
import anthropic

logger = logging.getLogger(__name__)

TEMPERAMENT_MOD = {"friendly": 1.0, "anxious": 1.15, "aggressive": 1.25}
TEMPERAMENT_MINS = {"friendly": 0, "anxious": 20, "aggressive": 30}


def estimate_price(breed: str, service_type: str, temperament: str = "friendly", coat_condition: str = "normal") -> dict:
    if not os.getenv("ANTHROPIC_API_KEY"):
        return {"price": None, "duration_minutes": 60, "notes": "AI pricing unavailable", "error": True}

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    temp_note = {
        "friendly": "",
        "anxious": " Dog is anxious — add 20 min and 15% to price.",
        "aggressive": " Dog is aggressive/requires muzzle — add 30 min and 25% to price.",
    }.get(temperament, "")

    prompt = (
        f"You are a professional pet groomer pricing assistant.\n"
        f"Breed: {breed or 'Mixed breed'}\n"
        f"Service: {service_type}\n"
        f"Coat condition: {coat_condition}\n"
        f"{temp_note}\n\n"
        "Return ONLY valid JSON with exactly these keys:\n"
        '"price" (number, USD, no dollar sign),\n'
        '"duration_minutes" (integer),\n'
        '"notes" (string, one short sentence explaining the price — e.g. "Double coat adds time")\n'
        "Base prices roughly: Bath $40-55, Bath & Cut $55-75, Full Groom $65-95, Nail Trim $15-25, Puppy Cut $60-80, De-shed $65-85. Scale by size."
    )

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        text = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
        return json.loads(text)
    except Exception as e:
        logger.error("[Pricing] error: %s", e)
        return {"price": None, "duration_minutes": 60, "notes": str(e), "error": True}
