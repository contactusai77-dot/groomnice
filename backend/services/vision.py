import base64
import json
import logging
import os
import re
import anthropic

logger = logging.getLogger(__name__)
_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


def extract_vaccine_info(image_bytes: bytes, media_type: str = "image/jpeg") -> dict:
    """
    Returns: { rabies_expiry: str|None, pet_name: str|None,
               confidence: "high"|"low", needs_review: bool }
    """
    if not os.getenv("ANTHROPIC_API_KEY"):
        logger.warning("[Vision stub] ANTHROPIC_API_KEY not set — skipping OCR")
        return {"rabies_expiry": None, "pet_name": None, "confidence": "low", "needs_review": True}

    global _client
    _client = None  # force fresh client so key changes are always picked up

    image_data = base64.standard_b64encode(image_bytes).decode("utf-8")

    response = _get_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "This is a pet vaccination or health record. "
                            "Find any expiration, expiry, or 'valid through' date — "
                            "it may be labeled as Rabies, DHPP, Bordetella, or just 'Exp'. "
                            "Use the latest expiry date visible. "
                            "Respond ONLY in valid JSON with these exact keys: "
                            '"rabies_expiry" (ISO date YYYY-MM-DD or null — use the latest expiry date found), '
                            '"pet_name" (string or null), '
                            '"confidence" ("high" or "low"), '
                            '"needs_review" (true ONLY if the image is physically unreadable or completely blank — '
                            "if any date is visible, set this to false)."
                        ),
                    },
                ],
            }
        ],
    )

    text = response.content[0].text.strip()
    logger.info("[Vision] raw response: %s", text)
    text = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    result = json.loads(text)
    logger.info("[Vision] parsed: %s", result)
    return result
