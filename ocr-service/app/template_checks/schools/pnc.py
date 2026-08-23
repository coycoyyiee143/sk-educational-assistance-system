from typing import List
from app.models import OcrBlock
from app.template_checks.base_strategy import BaseTemplateStrategy


class PncRegFormTemplateStrategy(BaseTemplateStrategy):
    # Selected based on OCR sample: lines that read clearly even with
    # the diagonal watermark overlay across the whole PNC form
    required_keywords = [
        "republic of the philippines",
        "registration form",
        "office of the university registrar",
        "university registrar",
        "unifast grantee",
    ]
    region_hints = {
        "republic of the philippines": "top",
        "registration form": "top",
        "office of the university registrar": "top",
        "university registrar": "bottom",
    }
    fuzzy_threshold = 0.75

    def extra_checks(self, blocks: List[OcrBlock], page_width, page_height) -> List[str]:
        # Strict "PNC:OUR-FO-XX" doc code check removed for now — it's
        # not read consistently by OCR even on genuine documents (small
        # text, affected by the watermark). Could be reintroduced as a
        # soft/optional signal instead of a hard flag.
        return []


class PncIdTemplateStrategy(BaseTemplateStrategy):
    required_keywords = [
        "university of cabuyao",
    ]
    region_hints = {
        "university of cabuyao": "top",
    }
    fuzzy_threshold = 0.75