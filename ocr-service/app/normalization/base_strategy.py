import re
from typing import Optional

class BaseSchoolStrategy:
    """Fallback validation processor using general document layout assumptions."""

    def extract_school_year(self, text: str, sy_format_hint: Optional[str] = None) -> Optional[str]:
        if not text:
            return None

        match = re.search(r'(20\d{2})[^0-9]*(20\d{2})', text)
        if match:
            return f"{match.group(1)}-{match.group(2)}"

        match = re.search(r'(20\d{2})[-/](\d{2})\b', text)
        if match:
            return f"{match.group(1)}-20{match.group(2)}"

        match = re.search(r'\b(20\d{2})\b', text)
        if match and sy_format_hint:
            single = match.group(1)
            if sy_format_hint == "single_year_as_start":
                return f"{single}-{int(single)+1}"
            elif sy_format_hint == "single_year_as_end":
                return f"{int(single)-1}-{single}"

        return None

    def preprocess_blocks(self, blocks):
        """
        Optional hook for school-specific block merging (e.g. joining a name
        or institution header that OCR splits across multiple lines).
        Default behavior: no changes, blocks pass through unmodified.
        """
        return blocks

    def match_target_names(self, official_name: str) -> list:
        """
        Optional hook returning every acceptable form of `official_name`
        to try when matching header text against it. Default: just the
        name itself. Override this when a school's printed ID/header
        STRUCTURALLY omits a word from its official name -- i.e. the
        card design never shows it at all, not an OCR miss on an
        otherwise-present word -- since fuzzy_match_school()'s length-
        ratio guard would otherwise block a perfectly genuine header from
        ever matching the full official name.
        """
        return [official_name]

    def id_card_expected_name(self, official_name: str) -> str:
        """
        Optional hook: the value to show a verifier as the School ID's
        "Expected" institution name. Default: the declared name itself.
        Override this when a school's ID card structurally never prints
        the full official name (see match_target_names) -- otherwise a
        genuinely correct, passing match still displays as if it were
        short of the full name, reading as a mismatch to a verifier.
        """
        return official_name