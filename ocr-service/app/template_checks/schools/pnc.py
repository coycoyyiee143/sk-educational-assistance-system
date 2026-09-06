# app/template_checks/schools/pnc.py
from typing import List
from app.models import OcrBlock
from app.template_checks.base_strategy import BaseTemplateStrategy


class PncRegFormTemplateStrategy(BaseTemplateStrategy):
    required_keywords = [
        "registration form",
        "office of the university registrar",
        "university registrar",
    ]
    region_hints = {
        "registration form": "top",
        "office of the university registrar": "top",
        "university registrar": "bottom",
    }
    fuzzy_threshold = 0.75

    def extra_checks(self, blocks: List[OcrBlock], page_width, page_height) -> List[str]:
        return []


class PncIdTemplateStrategy(BaseTemplateStrategy):
    required_keyword_groups = [
        ["university of cabuyao", "pamantasan ng cabuyao"],
    ]
    region_hints = {}
    fuzzy_threshold = 0.75