# app/normalization/schools/pnc.py
import re
from typing import Optional
from app.normalization.base_strategy import BaseSchoolStrategy

class PamantasanNgCabuyaoStrategy(BaseSchoolStrategy):
    """Custom parsing layer for PNC registrar declarations."""

    def extract_school_year(self, text: str, configured_year: Optional[str] = None) -> Optional[str]:
        # Targets: "Academic Year 20XX-20XX"
        match = re.search(r"academic\s*year\s*(\d{4})\s*-\s*(\d{4})", text, re.IGNORECASE)
        if match:
            return f"{match.group(1)}-{match.group(2)}"
        # Fallback to base heuristics if standard header format is missing
        return super().extract_school_year(text, configured_year)

    def extract_semester(self, text: str) -> Optional[str]:
        # PNC uses exactly "First Semester" or "Second Semester"
        t_lower = text.lower()
        if re.search(r"\bfirst\s*semester\b", t_lower):
            return "1"
        if re.search(r"\bsecond\s*semester\b", t_lower):
            return "2"
        return None

    def format_semester(self, value: str) -> str:
        """PNC uses 'First Semester' / 'Second Semester' format only."""
        v = str(value).strip().lower()
        if v in ('1', '1st', 'first'):
            return 'First Semester'
        elif v in ('2', '2nd', 'second'):
            return 'Second Semester'
        return value