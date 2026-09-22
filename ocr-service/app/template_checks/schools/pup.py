# app/template_checks/schools/pup.py
from typing import List
from app.models import OcrBlock
from app.template_checks.base_strategy import BaseTemplateStrategy


class PupRegFormTemplateStrategy(BaseTemplateStrategy):
    required_keywords = [
        "republic of the philippines",
        "certificate of registration",
        "polytechnic university of the philippines",
    ]
    fuzzy_threshold = 0.75

    def extra_checks(self, blocks: List[OcrBlock], page_width, page_height) -> List[str]:
        return []


class PupIdTemplateStrategy(BaseTemplateStrategy):
    """
    PUP's ID header sits behind a seal/watermark graphic that badly
    corrupts individual words on every real sample checked -- confirmed
    variants like "UNIvERSITN"/"UNIvERSIT" for UNIVERSITY and
    "PXILIPrInES"/"P Ritirrines"/"HIlIprineS" for PHILIPPINES, with
    "POLYTECHNIC" itself sometimes unreadable ("Polxrsod"). No single
    keyword survives on every sample, so this uses a keyword GROUP (any
    one alternative is enough) rather than required_keywords (all of
    them) -- confirmed at the standard 0.75 fuzzy threshold, each of the
    3 real samples checked has at least one of the three hit.
    """
    required_keyword_groups = [
        ["university", "philippines", "polytechnic"],
    ]
    fuzzy_threshold = 0.75
