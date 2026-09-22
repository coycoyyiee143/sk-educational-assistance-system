# app/template_checks/schools/svcc.py
from typing import List
from app.models import OcrBlock
from app.template_checks.base_strategy import BaseTemplateStrategy


class SvccRegFormTemplateStrategy(BaseTemplateStrategy):
    required_keywords = [
        "svcc registration form",
        "vincent college of cabuyao",
        "registration form",
    ]
    fuzzy_threshold = 0.75

    def extra_checks(self, blocks: List[OcrBlock], page_width, page_height) -> List[str]:
        return []
