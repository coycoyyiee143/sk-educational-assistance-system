from typing import List
from app.models import OcrBlock
from app.template_checks.base_strategy import BaseTemplateStrategy


class PncRegFormTemplateStrategy(BaseTemplateStrategy):
    required_keywords = [
        "republic of the philippines",
        "registration form",
        "office of the university registrar",
        "university registrar",
        # "unifast grantee" removed — not reliably captured by OCR even
        # on genuine documents; the header field near the watermark area
        # is frequently missed in the same way "certified correct" was
        # on the Voter's Certification.
    ]
    region_hints = {
        "republic of the philippines": "top",
        "registration form": "top",
        "office of the university registrar": "top",
        "university registrar": "bottom",
    }
    fuzzy_threshold = 0.75

    def extra_checks(self, blocks: List[OcrBlock], page_width, page_height) -> List[str]:
        return []


class PncIdTemplateStrategy(BaseTemplateStrategy):
    required_keywords = [
        "university of cabuyao",
    ]
    region_hints = {
        "university of cabuyao": "top",
    }
    fuzzy_threshold = 0.75