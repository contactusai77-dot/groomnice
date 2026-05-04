import base64
import json
import re
import anthropic

_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def extract_vaccine_info(image_bytes: bytes, media_type: str = "image/jpeg") -> dict:
    """
    Returns: { rabies_expiry: str|None, pet_name: str|None,
               confidence: "high"|"low", needs_review: bool }
    """
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
                            "This is a pet vaccination certificate. "
                            "Extract the following and respond ONLY in valid JSON "
                            "with these exact keys: "
                            '"rabies_expiry" (ISO date YYYY-MM-DD or null), '
                            '"pet_name" (string or null), '
                            '"confidence" ("high" or "low"), '
                            '"needs_review" (true if image is blurry, unreadable, '
                            "or expiry date cannot be found with confidence)."
                        ),
                    },
                ],
            }
        ],
    )

    text = response.content[0].text.strip()
    text = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    return json.loads(text)
