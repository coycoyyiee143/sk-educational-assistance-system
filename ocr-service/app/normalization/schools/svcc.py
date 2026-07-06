# app/normalization/schools/svcc.py
import re
from typing import Optional
from app.normalization.base_strategy import BaseSchoolStrategy

class StVincentCabuyaoStrategy(BaseSchoolStrategy):
    """Custom formatting parsing layer dedicated to St. Vincent College of Cabuyao (SVCC)."""

    def extract_school_year(self, text: str, sy_format_hint: Optional[str] = None) -> Optional[str]:
        # SVCC prints a single year meaning the START of the AY range
        # (ex. "School Year: 2025" -> "2025-2026")
        match = re.search(r"\b(20\d{2})\b", text)
        if match:
            start_year = int(match.group(1))
            return f"{start_year}-{start_year + 1}"
        return super().extract_school_year(text, sy_format_hint)