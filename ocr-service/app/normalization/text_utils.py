# app/normalization/text_utils.py
import re
import unicodedata
from rapidfuzz import fuzz
from rapidfuzz.distance import Levenshtein

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


def trim_to_match_window(text: str, expected: str, padding: int = 20, max_length: int = 150) -> str:
    """
    Returns just the portion of `text` that actually matched `expected`,
    plus a little surrounding context, instead of the whole raw string.

    Exists because PaddleOCR's own text detector sometimes merges what a
    human reads as several separate lines into ONE detected block --
    confirmed on a real UPLB Registration Form where the university name
    AND the entire admission-consent paragraph beneath it were read as a
    single line. Callers matching against a school/name still find that
    block via fuzzy_match_school()/fuzzy_match_name() (matching doesn't
    care how long the string is), but returning the ENTIRE block as the
    displayed "extracted" value shows a verifier hundreds of characters
    of irrelevant paragraph text instead of the actual matched name.

    Uses fuzz.partial_ratio_alignment on the UPPERCASED (not fully
    normalize_name()'d) strings deliberately -- .upper() doesn't change
    string length for the characters this deals with, so the returned
    src_start/src_end line up with the ORIGINAL text's character
    positions. Running this against the fully punctuation-stripped
    normalize_name() output would shift those positions out of sync
    with the string being sliced.

    Falls back to returning `text` unchanged on anything shorter than
    max_length (the normal case -- most extracted text is already just
    a name or a short line) or if alignment fails for any reason.
    """
    if not text or not expected or len(text) <= max_length:
        return text
    try:
        alignment = fuzz.partial_ratio_alignment(text.upper(), expected.upper())
        start = max(0, alignment.src_start - padding)
        end = min(len(text), alignment.src_end + padding)

        # Padding is a fixed character count, so it routinely lands
        # mid-word (e.g. "...CERTIFICATE OF REGI" instead of stopping at
        # a word boundary) -- snap each edge outward/inward to the
        # nearest space instead of cutting a word in half.
        if start > 0:
            space_idx = text.find(' ', start)
            if space_idx != -1 and space_idx < end:
                start = space_idx + 1
        if end < len(text):
            space_idx = text.rfind(' ', start, end)
            if space_idx != -1 and space_idx > start:
                end = space_idx

        window = text[start:end].strip()
        if not window:
            raise ValueError("empty match window")
        return f"{'…' if start > 0 else ''}{window}{'…' if end < len(text) else ''}"
    except Exception:
        return text[:max_length].rsplit(' ', 1)[0] + '…'


def fix_ocr_symbols(text: str) -> str:
    fixes = {
        r'\bIst\b': '1st', r'\bZnd\b': '2nd', r'\bZrd\b': '3rd',
    }
    for pattern, replacement in fixes.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text


def _component_present(target: str, text: str, threshold: int = 85) -> bool:
    """
    Does `target` (a single distinguishing word/name component) appear
    as a strong substring match somewhere in `text`? Shared by
    fuzzy_match_name (first/last name components) and
    fuzzy_match_school (a school's distinguishing word, e.g. "Los"/
    "Baños" for UPLB) -- both need the same "independently confirm this
    ISN'T a different match sharing generic words" guard.

    A flat percentage threshold punishes SHORT targets far harder than
    long ones -- one wrong character in a 4-letter word is a 25-point
    hit via partial_ratio, so anything <=6 characters effectively
    demands a PERFECT read even at an 85 bar (a single substitution
    already caps out around 83.3% at length 6). Confirmed on a real
    Voter's Certificate: "PAÑA" read as "PARA" -- not a diacritic-
    stripping issue, PaddleOCR's English character dictionary (lang='en'
    in ocr_engine.py) has no Ñ/ñ at all, so any Ñ-containing word NEVER
    reads correctly and always substitutes some other character --
    scored exactly 75% (below 85) for a single-edit miss on an
    otherwise-correct 4-letter surname.

    For short targets, tolerate exactly one edit (substitution/
    insertion/deletion) against the best-aligning window instead of
    enforcing the percentage bar -- a tighter, more principled guard
    than just lowering the percentage threshold would be (lowering the
    percentage for short strings risks accepting a GENUINELY different
    short word that happens to share most letters; capping at
    edit-distance 1 doesn't loosen that).
    """
    if not target or not text:
        return False
    if len(target) <= 6:
        alignment = fuzz.partial_ratio_alignment(target, text)
        window = text[alignment.dest_start:alignment.dest_end]
        return Levenshtein.distance(target, window) <= 1
    return fuzz.partial_ratio(target, text) >= threshold


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
        return _component_present(target, extracted_norm, threshold)

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

    # A short, acronym-length expected name (e.g. "NU", "PUP", "SVCC") has
    # no distinguishing word for the guard below to check --
    # _distinguishing_words() requires len>=3, and an acronym-only official
    # name IS that one short word -- so without this branch the match
    # would fall through to the raw partial_ratio/token_sort_ratio score
    # alone. A 2-3 letter sequence is short enough to coincidentally align
    # with a near-perfect score INSIDE a completely unrelated word or
    # sentence: confirmed on a real PUP School ID where "NU" scored high
    # enough to pass fuzzy_match_school() against ordinary course/degree
    # boilerplate text that never mentioned NU anywhere, which then
    # surfaced to a verifier as "Detected school appears to be NU." here
    # matching one whole WORD in the extracted text closely enough --
    # rather than letting the acronym align as a substring across a long,
    # unrelated run of text -- keeps a genuine short match (e.g. an actual
    # "NU" logo line) working while blocking that false positive.
    if len(e2) <= 6:
        tokens = [t for t in e1.split() if t]
        token_score = max((fuzz.ratio(t, e2) for t in tokens), default=0)
        return {"score": token_score, "passed": token_score >= threshold}

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
    if distinguishing and not any(_component_present(w, e1) for w in distinguishing):
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