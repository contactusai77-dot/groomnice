"""
Unit tests for backend/services/pricing.py.

The Anthropic API is mocked so these run fully offline.
"""
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))


def _make_response(payload: dict) -> MagicMock:
    """Build a fake anthropic Messages response with the given JSON payload."""
    content_block = MagicMock()
    content_block.text = json.dumps(payload)
    response = MagicMock()
    response.content = [content_block]
    return response


# ── No API key → stub response ────────────────────────────────────────────────

def test_no_api_key_returns_stub(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    from services import pricing
    result = pricing.estimate_price("Poodle", "Bath")
    assert result["price"] is None
    assert result.get("error") is True


# ── Happy path ────────────────────────────────────────────────────────────────

def test_returns_price_duration_notes(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "fake-key")
    mock_resp = _make_response({"price": 55.0, "duration_minutes": 60, "notes": "Standard bath"})

    with patch("services.pricing.anthropic.Anthropic") as MockAnthropic:
        MockAnthropic.return_value.messages.create.return_value = mock_resp
        from services import pricing
        result = pricing.estimate_price("Beagle", "Bath")

    assert result["price"] == 55.0
    assert result["duration_minutes"] == 60
    assert isinstance(result["notes"], str)


def test_aggressive_dog_adds_note(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "fake-key")
    mock_resp = _make_response({
        "price": 100.0, "duration_minutes": 90,
        "notes": "Aggressive — muzzle required, 25% surcharge",
    })

    with patch("services.pricing.anthropic.Anthropic") as MockAnthropic:
        MockAnthropic.return_value.messages.create.return_value = mock_resp
        from services import pricing
        result = pricing.estimate_price("Pitbull", "Full Groom", "aggressive", "matted")

    assert result["price"] == 100.0
    assert result["duration_minutes"] >= 60


def test_api_error_returns_error_dict(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "fake-key")

    with patch("services.pricing.anthropic.Anthropic") as MockAnthropic:
        MockAnthropic.return_value.messages.create.side_effect = Exception("API timeout")
        from services import pricing
        result = pricing.estimate_price("Poodle", "Bath")

    assert result.get("error") is True
    assert result["price"] is None


def test_malformed_json_response_returns_error(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "fake-key")
    content_block = MagicMock()
    content_block.text = "not valid json {{"
    bad_resp = MagicMock()
    bad_resp.content = [content_block]

    with patch("services.pricing.anthropic.Anthropic") as MockAnthropic:
        MockAnthropic.return_value.messages.create.return_value = bad_resp
        from services import pricing
        result = pricing.estimate_price("Poodle", "Bath")

    assert result.get("error") is True


# ── Response structure ─────────────────────────────────────────────────────────

def test_result_always_has_required_keys(monkeypatch):
    """Whether the call succeeds or fails, the result dict has price/duration/notes."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    from services import pricing
    result = pricing.estimate_price("Labrador", "Full Groom")
    for key in ("price", "duration_minutes", "notes"):
        assert key in result, f"Missing key '{key}' in: {result}"
