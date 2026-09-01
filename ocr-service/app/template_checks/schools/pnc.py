from typing import List
from app.models import OcrBlock
from app.template_checks.base_strategy import BaseTemplateStrategy


class PncRegFormTemplateStrategy(BaseTemplateStrategy):
    required_keywords = [
        "republic of the philippines",
        "registration form",
        "office of the university registrar",
        "university registrar",
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
    # School name appears on the ID in both English and Filipino — either
    # one being readable is sufficient, since which one OCR picks up
    # cleanly depends on the specific ID's wear/chipping, not on whether
    # it's genuine. Region hint dropped for now since it would need to
    # apply to whichever variant actually matched, not a fixed keyword —
    # a reasonable simplification for now, revisit if this needs to be
    # positionally strict later.
    required_keyword_groups = [
        ["university of cabuyao", "pamantasan ng cabuyao"],
    ]
    region_hints = {}
    fuzzy_threshold = 0.75