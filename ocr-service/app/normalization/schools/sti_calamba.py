# app/normalization/schools/sti_calamba.py
import re
from typing import Optional, Tuple
from app.normalization.base_strategy import BaseSchoolStrategy

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
        stripped = re.sub(r'\bcollege\b', '', official_name, flags=re.IGNORECASE)
        stripped = re.sub(r'\s+', ' ', stripped).strip()
        if stripped and stripped not in variants:
            variants.append(stripped)
        return variants