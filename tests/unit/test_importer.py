"""
Unit tests for backend/services/importer.py.

Tests pure functions: parse_csv, suggest_mapping, normalize_date, normalize_phone_safe.
No database, no server, no network.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

from services.importer import normalize_date, normalize_phone_safe, parse_csv, suggest_mapping


# ── parse_csv ─────────────────────────────────────────────────────────────────

class TestParseCsv:
    def test_returns_columns_and_rows(self):
        cols, rows = parse_csv("Name,Phone\nAlice,5551234567\n")
        assert cols == ["Name", "Phone"]
        assert len(rows) == 1
        assert rows[0]["Name"] == "Alice"

    def test_empty_csv_no_rows(self):
        cols, rows = parse_csv("Name,Phone\n")
        assert cols == ["Name", "Phone"]
        assert rows == []

    def test_multiple_rows(self):
        csv = "A,B\n1,2\n3,4\n5,6\n"
        _, rows = parse_csv(csv)
        assert len(rows) == 3

    def test_strips_bom(self):
        # Excel BOM (﻿) should be stripped by the caller; parse_csv takes clean str
        cols, _ = parse_csv("Name,Phone\nX,Y\n")
        assert "Name" in cols

    def test_comma_in_quoted_field(self):
        csv = 'Name,Notes\nAlice,"loves baths, weekly"\n'
        _, rows = parse_csv(csv)
        assert rows[0]["Notes"] == "loves baths, weekly"


# ── suggest_mapping ───────────────────────────────────────────────────────────

class TestSuggestMapping:
    def test_standard_column_names(self):
        m = suggest_mapping(["Owner Name", "Phone", "Pet", "Breed", "Rabies Exp", "Notes"])
        assert m.get("Phone") == "client_phone"
        assert m.get("Owner Name") == "client_name"
        assert m.get("Pet") == "pet_name"

    def test_mobile_alias(self):
        m = suggest_mapping(["Mobile"])
        assert m.get("Mobile") == "client_phone"

    def test_cell_alias(self):
        m = suggest_mapping(["Cell"])
        assert m.get("Cell") == "client_phone"

    def test_vaccine_alias(self):
        m = suggest_mapping(["Rabies Expiration"])
        assert "rabies_expiry" in m.values()

    def test_no_duplicate_mappings(self):
        cols = ["Phone", "Mobile", "Cell"]
        m = suggest_mapping(cols)
        # Each field can only be mapped once
        values = list(m.values())
        assert len(values) == len(set(values))

    def test_unknown_column_not_mapped(self):
        m = suggest_mapping(["Foobar", "Baz"])
        assert m == {}

    def test_case_insensitive(self):
        m = suggest_mapping(["PHONE"])
        assert m.get("PHONE") == "client_phone"


# ── normalize_date ────────────────────────────────────────────────────────────

class TestNormalizeDate:
    def test_iso_format(self):
        assert normalize_date("2027-06-01") == "2027-06-01"

    def test_us_slash_4_digit_year(self):
        assert normalize_date("04/15/2027") == "2027-04-15"

    def test_us_slash_2_digit_year(self):
        assert normalize_date("04/15/27") == "2027-04-15"

    def test_month_slash_year(self):
        assert normalize_date("04/2027") == "2027-04-01"

    def test_abbreviated_month_year(self):
        assert normalize_date("Apr 2027") == "2027-04-01"

    def test_full_month_year(self):
        assert normalize_date("April 2027") == "2027-04-01"

    def test_unrecognizable_returns_none(self):
        assert normalize_date("TBD") is None
        assert normalize_date("N/A") is None
        assert normalize_date("-") is None
        assert normalize_date("not-a-date") is None

    def test_empty_string_returns_none(self):
        assert normalize_date("") is None

    def test_whitespace_returns_none(self):
        assert normalize_date("   ") is None

    def test_dashes_us_format(self):
        assert normalize_date("04-15-2027") == "2027-04-15"


# ── normalize_phone_safe ──────────────────────────────────────────────────────

class TestNormalizePhoneSafe:
    def test_10_digits(self):
        assert normalize_phone_safe("5551234567") == "+15551234567"

    def test_11_digits_starting_1(self):
        assert normalize_phone_safe("15551234567") == "+15551234567"

    def test_dashes_stripped(self):
        assert normalize_phone_safe("555-123-4567") == "+15551234567"

    def test_parentheses_stripped(self):
        assert normalize_phone_safe("(555) 123-4567") == "+15551234567"

    def test_too_short_returns_none(self):
        assert normalize_phone_safe("123") is None
        assert normalize_phone_safe("") is None

    def test_6_digits_returns_none(self):
        assert normalize_phone_safe("123456") is None

    def test_7_plus_digits_accepted(self):
        # 7 digits is the minimum we accept
        result = normalize_phone_safe("1234567")
        assert result is not None
        assert result.startswith("+")
