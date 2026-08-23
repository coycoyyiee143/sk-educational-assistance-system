from typing import List
from app.models import OcrBlock
from app.template_checks.base_strategy import BaseTemplateStrategy


class ComelecVotersCertTemplateStrategy(BaseTemplateStrategy):
    """
    Generic template check for the COMELEC Voter's Certification —
    this is a national government format, not a per-school one, so a
    single strategy covers every applicant regardless of declared school.
    """
    required_keywords = [
        "republic of the philippines",
        "commission on elections",
        "voter's certification",
        "office of the election officer",
        # "certified correct" intentionally excluded — it frequently
        # overlaps with the handwritten signature area and isn't
        # reliably captured by OCR even on genuine certificates
    ]
    region_hints = {
        "republic of the philippines": "top",
        "commission on elections": "top",
        "voter's certification": "top",
    }
    fuzzy_threshold = 0.75

    def extra_checks(self, blocks: List[OcrBlock], page_width, page_height) -> List[str]:
        flags = []
        full_text = " ".join(b.text.lower() for b in blocks)
        # Genuine COMELEC certificates print a "HASH:" line at the bottom
        # as a document integrity marker — a lightweight structural signal
        # on top of the keyword checks above.
        if "hash" not in full_text:
            flags.append("Missing expected 'HASH' verification marker")
        return flags