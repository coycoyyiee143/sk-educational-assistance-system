# app/normalization/text_utils.py
import re
import unicodedata
from rapidfuzz import fuzz

def clean_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def strip_diacritics(text: str) -> str:
    """
    Folds accented letters to their plain ASCII equivalent (e.g. 'Ñ' ->
    'N', 'á' -> 'a') -- OCR almost always drops the accent/tilde entirely
    on a genuine, correctly-scanned document (confirmed on a real UPLB
    sample: 'Paña' consistently reads as 'Pana'), so comparing an
    un-folded applicant-provided name against OCR text penalizes a
    correct read as if it were a real character mismatch.
    """
    decomposed = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in decomposed if not unicodedata.combining(c))


def normalize_name(name: str) -> str:
    name = clean_text(name)
    name = strip_diacritics(name)
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
    # Normalized (accent-folded) the same way as extracted_norm above --
    # otherwise an applicant's own accented name (e.g. "Paña") never
    # matches their own correctly-scanned document, since OCR reads it
    # as "Pana" (see strip_diacritics()).
    fn = normalize_name(first_name)
    mn = normalize_name(middle_name) if middle_name else ""
    ln = normalize_name(last_name)

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


# Generic institutional words that appear across MANY different real
# schools' official names and can't distinguish one from another on
# their own -- e.g. "University of the Philippines Los Baños" and
# "Polytechnic University of the Philippines" share every one of these
# words. Confirmed as a real false-positive, not hypothetical: an OCR
# misread on a genuine UPLB ID ("Polytechnic University. of the
# Philippines" -- the text detector garbled an occluded fragment into
# a real but wrong institution name) scored high enough via aggregate
# similarity alone to pass fuzzy_match_school() against the declared
# UPLB school, despite literally naming a different university.
#
# "POLYTECHNIC" is deliberately NOT in this set -- it's the one word
# that actually distinguishes "Polytechnic University of the
# Philippines" (PUP) from plain "University of the Philippines" (UP),
# two genuinely different, easily-confusable real schools differing by
# exactly that word. Treating it as generic filler would let a plain
# UP-system name (no "Polytechnic" at all) falsely pass as PUP on
# aggregate similarity alone -- confirmed: a same-length "University of
# the Philippines System Manila" scored 86% against declared PUP with
# "Polytechnic" wrongly stopworded, the identical class of false
# positive this whole guard exists to catch.
_SCHOOL_STOPWORDS = {
    "UNIVERSITY", "COLLEGE", "OF", "THE", "SYSTEM", "SAINT", "ST",
    "PAMANTASAN", "NG", "SCHOOL", "INSTITUTE", "STATE",
    "PHILIPPINES", "NATIONAL",
}


def _distinguishing_words(normalized_name: str) -> list:
    return [w for w in normalized_name.split() if w not in _SCHOOL_STOPWORDS and len(w) >= 3]


def fuzzy_match_school(extracted: str, expected: str, threshold: int = 85) -> dict:
    if not extracted or not expected:
        return {"score": 0, "passed": False}
    e1 = normalize_name(extracted)
    e2 = normalize_name(expected)
    # A school's full name has no legitimate shortened form the way a
    # person's name can have a nickname or be missing a middle name --
    # a genuine read should capture nearly the whole name. This guard
    # used to be len(extracted) < half of expected, which let a bare
    # generic institutional word through (e.g. "Pamantasan" alone
    # scored a perfect 100 via partial_ratio against "Pamantasan ng
    # Cabuyao", since it's a literal substring -- and "Pamantasan" is
    # shared by several actual Philippine universities: Pamantasan ng
    # Lungsod ng Maynila, ng Pasig, ng Cabuyao, etc. -- so this was a
    # real false-positive risk, not a hypothetical one). 0.75 blocks
    # that while still passing a 1-letter OCR typo on the full name and
    # a legitimate longer official-name variant.
    if len(e1) < 0.75 * len(e2):
        return {"score": 0, "passed": False}
    score = max(fuzz.token_sort_ratio(e1, e2), fuzz.partial_ratio(e1, e2))

    # Stylized/logo-style header text (school names in particular) often
    # gets its internal word-spacing garbled by OCR while the underlying
    # LETTERS are still substantially correct -- e.g. a genuine read of
    # "Polytechnic" coming back as "P o lytechnic" (confirmed on a real
    # PUP school ID: header lines individually read at 85-90% OCR
    # confidence, letters all correct, but spurious spaces mid-word).
    # Same class of artifact reinsert_name_spacing() already corrects for
    # names. Comparing letter sequences with spacing stripped from BOTH
    # sides recovers a genuine match without being fooled by a scan that
    # happens to have clean spacing (both sides are folded the same way,
    # so a correctly-spaced extract isn't penalized or favored).
    e1_nospace = e1.replace(' ', '')
    e2_nospace = e2.replace(' ', '')
    score = max(score, fuzz.ratio(e1_nospace, e2_nospace), fuzz.token_sort_ratio(e1_nospace, e2_nospace))

    # Aggregate similarity alone can stay high purely from generic words
    # shared with a genuinely DIFFERENT school (see _SCHOOL_STOPWORDS).
    # If the expected name has at least one real distinguishing word (a
    # campus/founder/location name, not a ubiquitous institutional
    # term), require it to independently appear as a strong substring
    # match -- the same guard fuzzy_match_name already applies to
    # first/last name. Some official names (e.g. "Polytechnic University
    # of the Philippines") have no non-generic word at all; there's
    # nothing more specific to check for those, so they fall back to the
    # aggregate score alone.
    distinguishing = _distinguishing_words(e2)
    if distinguishing and not any(fuzz.partial_ratio(w, e1) >= 85 for w in distinguishing):
        return {"score": score, "passed": False}

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