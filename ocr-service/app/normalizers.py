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
        score = fuzz.token_sort_ratio(
            extracted_norm, normalize_name(candidate)
        )
        if len(extracted_norm) >= min_len:
            score = max(score, fuzz.partial_ratio(
                extracted_norm, normalize_name(candidate)
            ))
        best_score = max(best_score, score)

    return {"score": best_score, "passed": best_score >= threshold}


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