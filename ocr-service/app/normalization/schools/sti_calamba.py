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