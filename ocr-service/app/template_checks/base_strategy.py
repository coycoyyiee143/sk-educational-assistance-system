# app/template_checks/base_strategy.py
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from difflib import SequenceMatcher
from app.models import OcrBlock
from app.extraction.blocks import get_page_dimensions


@dataclass
class TemplateCheckResult:
    passed: bool
    flags: List[str] = field(default_factory=list)
    score: float = 1.0


def fuzzy_contains(full_text: str, keyword: str, threshold: float = 0.75) -> bool:
    """
    Not an exact substring match — watermark/OCR noise corrupts some
    letters even on genuine documents (e.g. 'Cabuyao' -> 'Cabupao').
    We slide a window of the same word-length across full_text and take
    the highest similarity ratio against the keyword.
    """
    keyword = keyword.lower()
    if keyword in full_text:
        return True

    # Handles OCR occasionally merging a multi-word keyword into one
    # unspaced token — e.g. "(PAMANTASANNGCABUYAO)" for "Pamantasan ng
    # Cabuyao", confirmed on a real ID sample. Word-window matching
    # below can't catch this since the word count no longer lines up.
    keyword_squished = keyword.replace(" ", "")
    full_text_squished = full_text.replace(" ", "")
    if keyword_squished in full_text_squished:
        return True

    words = full_text.split()
    kw_len = len(keyword.split())
    for i in range(len(words) - kw_len + 1):
        window = " ".join(words[i:i + kw_len])
        ratio = SequenceMatcher(None, window, keyword).ratio()
        if ratio >= threshold:
            return True
    return False


def describe_score(score: float) -> str:
    """Converts a numeric layout score into a verifier-friendly label."""
    if score >= 1.0:
        return "Layout Matches Expected Format"
    if score >= 0.8:
        return "Minor Layout Deviation"
    if score >= 0.6:
        return "Moderate Layout Deviation"
    return "Significant Layout Deviation"


class BaseTemplateStrategy:
    required_keywords: List[str] = []
    # Each inner list is a set of acceptable ALTERNATIVES for one field —
    # at least ONE keyword in the group must be found, not all of them.
    # Use this instead of required_keywords when a document legitimately
    # prints more than one valid variant of the same field (e.g. a
    # school's English and Filipino name both appearing on an ID).
    required_keyword_groups: List[List[str]] = []
    region_hints: Dict[str, str] = {}
    fuzzy_threshold: float = 0.75

    def check(self, blocks: List[OcrBlock]) -> TemplateCheckResult:
        flags: List[str] = []
        page_width, page_height = get_page_dimensions(blocks)
        full_text = " ".join(b.text.lower() for b in blocks)

        for kw in self.required_keywords:
            if not fuzzy_contains(full_text, kw, self.fuzzy_threshold):
                flags.append(f"Missing expected text: '{kw}'")
                continue

            expected_region = self.region_hints.get(kw)
            if expected_region:
                block = self._find_closest_block(blocks, kw)
                if block and not self._in_region(block, page_height, expected_region):
                    flags.append(f"'{kw}' found but not in expected {expected_region} region")

        for group in self.required_keyword_groups:
            if not any(fuzzy_contains(full_text, kw, self.fuzzy_threshold) for kw in group):
                flags.append(f"Missing expected text: one of {group}")

        flags.extend(self.extra_checks(blocks, page_width, page_height))
        score = max(0.0, 1.0 - (0.2 * len(flags)))
        return TemplateCheckResult(passed=len(flags) == 0, flags=flags, score=score)

    def extra_checks(self, blocks, page_width, page_height) -> List[str]:
        return []

    def _find_closest_block(self, blocks: List[OcrBlock], kw: str) -> Optional[OcrBlock]:
        best, best_ratio = None, 0.0
        for b in blocks:
            ratio = SequenceMatcher(None, b.text.lower(), kw).ratio()
            if ratio > best_ratio:
                best, best_ratio = b, ratio
        return best if best_ratio >= self.fuzzy_threshold else None

    def _in_region(self, block: OcrBlock, page_height: float, region: str) -> bool:
        mid_y = (block.y_min + block.y_max) / 2
        ratio = mid_y / page_height if page_height else 0
        if region == "top":
            return ratio <= 0.35
        if region == "middle":
            return 0.25 <= ratio <= 0.75
        if region == "bottom":
            return ratio >= 0.65
        return True