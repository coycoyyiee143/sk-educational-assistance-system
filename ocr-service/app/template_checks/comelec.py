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
        "voter's certification",
        # via OCR even on genuine documents, due to small, light-colored
        # font weight positioned close to the COMELEC seal graphic.
    ]
    region_hints = {}
    fuzzy_threshold = 0.6

    def extra_checks(self, blocks: List[OcrBlock], page_width, page_height) -> List[str]:
        flags = []
        full_text = " ".join(b.text.lower() for b in blocks)
        # Genuine COMELEC certificates print a "HASH:" line at the bottom
        # as a document integrity marker — a lightweight structural signal
        # on top of the keyword check above.
        if "hash" not in full_text:
            flags.append("Missing expected 'HASH' verification marker")
        return flags