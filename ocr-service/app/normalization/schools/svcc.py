import re
from typing import Optional, List, Dict
from app.normalization.base_strategy import BaseSchoolStrategy

class StVincentCabuyaoStrategy(BaseSchoolStrategy):
    """Custom formatting parsing layer dedicated to St. Vincent College of Cabuyao (SVCC)."""

    def extract_academic_info(self, blocks: List, page_w: float, page_h: float) -> Dict[str, Optional[str]]:
        """
        Leverages geometric filtering to extract academic info from the top header zone.
        """
        data = {"sy": None, "sem": None}
        
        for block in blocks:
            # Target only blocks in the top 20% of the document height
            if block.bbox[0][1] < 0.20:  
                text = block.text.lower().strip()
                
                # 1. Extract Semester
                if "sem" in text:
                    if re.search(r'\b(1st|first|1)\b', text):
                        data["sem"] = "1"
                    elif re.search(r'\b(2nd|second|2)\b', text):
                        data["sem"] = "2"
                
                # 2. Extract School Year (Handling both '2025-2026' and '2026' formats)
                if "school year" in text or "sy" in text:
                    # Pattern A: Standard range (e.g., 2025-2026)
                    range_match = re.search(r"(\d{4})\s*-\s*(\d{4}|\d{2})\b", text)
                    # Pattern B: Single year (e.g., 2026)
                    single_match = re.search(r"\b(20\d{2})\b", text)
                    
                    if range_match:
                        year1 = range_match.group(1)
                        year2 = range_match.group(2)
                        if len(year2) == 2:
                            year2 = f"20{year2}"
                        data["sy"] = f"{year1}-{year2}"
                    elif single_match:
                        # Logic: If year is 2026, interpret as 2025-2026
                        end_year = int(single_match.group(1))
                        data["sy"] = f"{end_year - 1}-{end_year}"
                        
        return data

    def extract_school_year(self, text: str, configured_year: Optional[str] = None) -> Optional[str]:
        # Support single year extraction in fallback as well
        match = re.search(r"\b(20\d{2})\b", text)
        if match:
            end_year = int(match.group(1))
            return f"{end_year - 1}-{end_year}"
        return super().extract_school_year(text, configured_year)

    def extract_semester(self, text: str) -> Optional[str]:
        clean_text = text.lower()
        if re.search(r'\b(1st|first|1)\s*(sem|semester)\b', clean_text):
            return "1"
        if re.search(r'\b(2nd|second|2)\s*(sem|semester)\b', clean_text):
            return "2"
        return super().extract_semester(text)