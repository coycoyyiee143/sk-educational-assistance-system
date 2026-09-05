# app/normalization/text_utils.py
import re
from rapidfuzz import fuzz

def clean_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def normalize_name(name: str) -> str:
    name = clean_text(name)
    name = re.sub(r'[^\w\s]', '', name)
    return name.upper().strip()


def fix_ocr_symbols(text: str) -> str:
    fixes = {
        r'\bIst\b': '1st', r'\bZnd\b': '2nd', r'\bZrd\b': '3rd',
    }
    for pattern, replacement in fixes.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text


def fuzzy_match_name(extracted: str, first_name: str, middle_name: str,
                     last_name: str, threshold: int = 85) -> dict:
    if not extracted:
        return {"score": 0, "passed": False}
    extracted_norm = normalize_name(extracted)
    fn = first_name.strip().upper()
    mn = middle_name.strip().upper() if middle_name else ""
    ln = last_name.strip().upper()

    candidates = []
    if mn:
        candidates += [
            f"{fn} {mn} {ln}", f"{ln} {fn} {mn}",
            f"{ln}, {fn} {mn}", f"{ln} {fn} {mn[0]}",
            f"{fn} {mn[0]} {ln}", f"{ln}, {fn} {mn[0]}",
        ]
    candidates += [f"{fn} {ln}", f"{ln} {fn}", f"{ln}, {fn}"]

    best_score = 0
    min_len = max(4, len(normalize_name(f"{fn} {ln}")) - 4)
    for candidate in candidates:
        score = fuzz.token_sort_ratio(extracted_norm, normalize_name(candidate))
        if len(extracted_norm) >= min_len:
            score = max(score, fuzz.partial_ratio(extracted_norm, normalize_name(candidate)))
        best_score = max(best_score, score)

    # An aggregate score across the whole name can stay high even when
    # the most identity-distinguishing part is a DIFFERENT person's.
    # First and last name are each required to independently appear as
    # a strong SUBSTRING match somewhere in the extracted text (via
    # partial_ratio) -- not just contribute to one blended aggregate
    # score. Checked against the whole extracted string rather than
    # token-by-token, since a first or middle name can be more than one
    # word (e.g. "Regina Grace") and would never match a single split
    # token on its own.
    def component_present(target: str, threshold: int = 85) -> bool:
        if not target or not extracted_norm:
            return False
        return fuzz.partial_ratio(target, extracted_norm) >= threshold

    if not (component_present(fn) and component_present(ln)):
        return {"score": best_score, "passed": False}

    return {"score": best_score, "passed": best_score >= threshold}


def reinsert_name_spacing(raw: str, first_name: str, middle_name: str, last_name: str) -> str:
    """
    Some OCR reads glue a name into one unspaced token (a real
    recognition-level quirk on certain fonts/kerning — not something
    this pipeline causes). This reconstructs spacing by finding 
    which known name arrangement's LETTERS actually line up, 
    in order, with raw's own letters — not just matching total
    length, since any reordering of the same letters has the same
    length. fuzz.ratio (order-sensitive, unlike fuzzy_match_name's
    token_sort_ratio) is used specifically so a wrong-order candidate
    can't be mistaken for a match just because it happens to be the
    same length. Only applies when that alignment is near-exact —
    otherwise leaves raw untouched rather than guessing wrong.
    """
    if not raw:
        return raw
    if ' ' in raw.strip():
        return raw  # already has spacing, nothing to fix

    fn = first_name.strip().upper()
    mn = middle_name.strip().upper() if middle_name else ""
    ln = last_name.strip().upper()

    candidates = []
    if mn:
        candidates += [f"{fn} {mn} {ln}", f"{ln} {fn} {mn}", f"{ln} {fn} {mn[0]}", f"{fn} {mn[0]} {ln}"]
    candidates += [f"{fn} {ln}", f"{ln} {fn}"]

    raw_letters = re.sub(r'[^A-Za-z]', '', raw).upper()

    best_candidate, best_ratio = None, 0
    for candidate in candidates:
        candidate_letters = re.sub(r'[^A-Za-z]', '', candidate)
        if len(candidate_letters) != len(raw_letters):
            continue
        ratio = fuzz.ratio(raw_letters, candidate_letters)
        if ratio > best_ratio:
            best_ratio, best_candidate = ratio, candidate

    if best_candidate and best_ratio >= 90:
        words = best_candidate.split(' ')
        result, pos = [], 0
        for w in words:
            result.append(raw_letters[pos:pos + len(w)])
            pos += len(w)
        return ' '.join(result)

    return raw  # no confident letter-order alignment — leave as-is, no harm done


def fuzzy_match_school(extracted: str, expected: str, threshold: int = 85) -> dict:
    if not extracted or not expected:
        return {"score": 0, "passed": False}
    e1 = normalize_name(extracted)
    e2 = normalize_name(expected)
    if len(extracted) < max(4, len(expected) // 2):
        return {"score": 0, "passed": False}
    score = max(fuzz.token_sort_ratio(e1, e2), fuzz.partial_ratio(e1, e2))
    return {"score": score, "passed": score >= threshold}


def combine_confidence(ocr_confidence: float, similarity_score: float,
                        weight_ocr: float = 0.4, weight_similarity: float = 0.6) -> float:
    """
    Blends raw OCR confidence (0-1) with a fuzzy similarity score (0-100)
    into one 0-1 confidence value.
    Weights are a starting default — tune against Sprint 5 eval set results,
    don't treat 0.4/0.6 as final.
    """
    normalized_similarity = similarity_score / 100.0
    return round((ocr_confidence * weight_ocr) + (normalized_similarity * weight_similarity), 4)