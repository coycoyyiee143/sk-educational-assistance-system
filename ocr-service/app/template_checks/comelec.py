from typing import List
from app.models import OcrBlock
from app.template_checks.base_strategy import BaseTemplateStrategy, fuzzy_contains


class ComelecVotersCertTemplateStrategy(BaseTemplateStrategy):
    """
    Generic template check for the COMELEC Voter's Certification —
    this is a national government format, not a per-school one, so a
    single strategy covers every applicant regardless of declared school.
    """
    required_keywords = [
        "voter's certification",
    ]
    region_hints = {}
    fuzzy_threshold = 0.6

    def extra_checks(self, blocks: List[OcrBlock], page_width, page_height) -> List[str]:
        # No extra checks beyond the base template match for this
        # school — layout/keyword presence alone is enough here.
        return []