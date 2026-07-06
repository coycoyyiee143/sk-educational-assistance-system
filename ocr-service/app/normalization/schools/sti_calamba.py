# app/normalization/schools/sti_calamba.py
import re
from typing import Optional, Tuple
from app.normalization.base_strategy import BaseSchoolStrategy

class StiCalambaStrategy(BaseSchoolStrategy):
    """Parsing layer utilizing the required header pattern: 2526/2T."""

    def decode_sti_term_code(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        # This matches the specific pattern you provided
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

    def extract_semester(self, text: str) -> Optional[str]:
        # STI uses exactly the "XXYY/ZT" format where Z is the term (1T or 2T)
        _, term = self.decode_sti_term_code(text)
        return term

    def format_semester(self, value: str) -> str:
        """STI uses 'T' format like '1T' or '2T'."""
        v = str(value).strip().lower()
        if v in ('1', '1st', 'first'):
            return '1T'
        elif v in ('2', '2nd', 'second'):
            return '2T'
        return value