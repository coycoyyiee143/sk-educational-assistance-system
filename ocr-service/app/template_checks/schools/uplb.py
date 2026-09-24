# app/template_checks/schools/uplb.py
from typing import List
from app.models import OcrBlock
from app.template_checks.base_strategy import BaseTemplateStrategy


class UplbRegFormTemplateStrategy(BaseTemplateStrategy):
    """
    UPLB's registration form prints its institution header ("University
    of the Philippines Los Baños Certificate of Registration") in solid
    red -- confirmed the detector misses that line entirely on the raw
    color image (see app/ocr_engine.py), so it never appears in the
    OCR'd blocks at all, not even at low confidence. Anchoring on the
    literal school name is therefore unreliable; this instead anchors on
    the UP-specific legal/boilerplate text that reads cleanly on every
    real sample checked (RA 10931 free tuition notice, the UP Privacy
    Notice acknowledgement, "Form 5 issued by").
    """
    required_keywords = [
        "student pledge and data privacy reminders",
        "up privacy notice for students",
        "ra 10931",
        "form 5 issued by",
    ]
    fuzzy_threshold = 0.75

    def extra_checks(self, blocks: List[OcrBlock], page_width, page_height) -> List[str]:
        return []
