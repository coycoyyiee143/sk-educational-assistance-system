# app/normalization/schools/sti_calamba.py
import re
from typing import Optional, Tuple
from app.normalization.base_strategy import BaseSchoolStrategy

def _strip_college(official_name: str) -> str:
    stripped = re.sub(r'\bcollege\b', '', official_name, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', stripped).strip()


class StiCalambaStrategy(BaseSchoolStrategy):
    """Parsing layer utilizing the required header pattern: 2X2X/XT."""

    def decode_sti_term_code(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        match = re.search(r'\b(\d{2})(\d{2})\s*/\s*([12])t\b', text, re.IGNORECASE)
        if match:
            year1 = f"20{match.group(1)}"
            year2 = f"20{match.group(2)}"
            term = match.group(3)
            return f"{year1}-{year2}", term
        return None, None

    def extract_school_year(self, text: str, sy_format_hint: Optional[str] = None) -> Optional[str]:
        sy, _ = self.decode_sti_term_code(text)
        return sy if sy else super().extract_school_year(text, sy_format_hint)

    def match_target_names(self, official_name: str) -> list:
        # STI's School ID prints a two-line logo reading "STI" over
        # "CALAMBA" -- the word "College" never appears anywhere on the
        # card at all (confirmed by inspecting real STI ID scans), unlike
        # a genuine OCR miss on an otherwise-present header word. Without
        # this, fuzzy_match_school()'s 0.75 length-ratio guard blocks
        # even a perfectly-read "STI CALAMBA" header from ever matching
        # the full declared name "STI College Calamba", misflagging every
        # genuine STI School ID as an institution mismatch.
        variants = [official_name]
        stripped = _strip_college(official_name)
        if stripped and stripped not in variants:
            variants.append(stripped)
        return variants

    def expected_school_year_display(self, configured_school_year: str) -> str:
        # STI's Registration Form/Voter's Certificate never prints a plain
        # "2025-2026" anywhere -- only the compact "2526/XT" header code
        # (see decode_sti_term_code). Showing the configured value as-is
        # next to a genuinely correct "2526/2T" read looks like a mismatch
        # to a verifier. The term digit isn't shown here since it isn't
        # part of the configured school year and isn't itself validated
        # (decode_sti_term_code discards it) -- only the year pair is.
        match = re.match(r'(\d{4})-(\d{4})', configured_school_year)
        if match:
            return f"{match.group(1)[-2:]}{match.group(2)[-2:]}"
        return configured_school_year

    def id_card_expected_name(self, official_name: str) -> str:
        # The School ID's "Expected" value shown to a verifier should
        # match what the card actually prints ("STI Calamba") rather
        # than the full declared name ("STI College Calamba") -- showing
        # the full name next to a correctly-matched "STI CALAMBA" read
        # looks like a mismatch to a verifier even though it passed.
        return _strip_college(official_name) or official_name