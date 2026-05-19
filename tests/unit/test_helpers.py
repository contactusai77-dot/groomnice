"""
Unit tests for pure helper functions in backend/helpers.py.

No DB, no auth, no network — helpers.py has zero heavy dependencies.
"""
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

from helpers import haversine, normalize_phone, slug_from, vaccine_ok


# ── normalize_phone ────────────────────────────────────────────────────────────

class TestNormalizePhone:
    def test_10_digit_adds_plus1(self):
        assert normalize_phone("5551234567") == "+15551234567"

    def test_11_digit_starting_1(self):
        assert normalize_phone("15551234567") == "+15551234567"

    def test_dashes_stripped(self):
        assert normalize_phone("555-123-4567") == "+15551234567"

    def test_parentheses_stripped(self):
        assert normalize_phone("(555) 123-4567") == "+15551234567"

    def test_already_e164(self):
        assert normalize_phone("+15551234567") == "+15551234567"

    def test_short_number_gets_plus_prefix(self):
        result = normalize_phone("123456")
        assert result.startswith("+")


# ── vaccine_ok ─────────────────────────────────────────────────────────────────

class TestVaccineOk:
    def _pet(self, expiry):
        p = MagicMock()
        p.rabies_expiry = expiry
        return p

    def test_no_pet_returns_false(self):
        assert vaccine_ok(None) is False

    def test_no_expiry_returns_false(self):
        assert vaccine_ok(self._pet(None)) is False

    def test_future_expiry_returns_true(self):
        assert vaccine_ok(self._pet("2099-01-01")) is True

    def test_past_expiry_returns_false(self):
        assert vaccine_ok(self._pet("2020-01-01")) is False

    def test_today_expiry_returns_bool(self):
        today = datetime.utcnow().strftime("%Y-%m-%d")
        assert isinstance(vaccine_ok(self._pet(today)), bool)

    def test_invalid_expiry_string_does_not_crash(self):
        assert isinstance(vaccine_ok(self._pet("not-a-date")), bool)


# ── slug_from ──────────────────────────────────────────────────────────────────

class TestSlugFrom:
    def test_spaces_become_dashes(self):
        assert slug_from("hello world") == "hello-world"

    def test_lowercase(self):
        assert "sarah" in slug_from("Sarah's Paws")

    def test_special_chars_become_dashes(self):
        result = slug_from("Top Dog! & Co.")
        assert all(c.isalnum() or c == "-" for c in result)

    def test_empty_string_returns_groomer(self):
        assert slug_from("") == "groomer"

    def test_leading_trailing_dashes_stripped(self):
        result = slug_from("---hello---")
        assert not result.startswith("-")
        assert not result.endswith("-")


# ── haversine ──────────────────────────────────────────────────────────────────

class TestHaversine:
    def test_same_point_zero(self):
        assert haversine(40.0, -74.0, 40.0, -74.0) == pytest.approx(0.0, abs=0.001)

    def test_nyc_to_la_approx(self):
        dist = haversine(40.71, -74.01, 34.05, -118.24)
        assert 2400 < dist < 2500, f"NYC-LA distance unexpected: {dist}"

    def test_symmetry(self):
        d1 = haversine(37.77, -122.42, 34.05, -118.24)
        d2 = haversine(34.05, -118.24, 37.77, -122.42)
        assert d1 == pytest.approx(d2, rel=1e-9)

    def test_short_distance_reasonable(self):
        dist = haversine(40.7128, -74.0060, 40.7282, -74.0060)
        assert 0.5 < dist < 2.0
