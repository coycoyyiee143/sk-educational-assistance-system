# app/verification/shared.py
from app.extraction import extract_name, extract_school

CONFIDENCE_THRESHOLD = 0.75

# Floor for _check_name / _check_school specifically. Both extraction
# functions blend raw OCR confidence with a name/school text-similarity
# score via combine_confidence() (weight_ocr=0.4, weight_similarity=0.6),
# and only return a result once similarity >= 85. That gate alone puts
# a floor under the blended number — even with OCR confidence of 0, the
# blended score is still ~0.51 (0.6 * 0.85). A threshold anywhere near
# 0.5 would therefore almost never fire; it needs to sit meaningfully
# above that built-in floor to actually catch a case where the OCR read
# itself was weak even though the text happened to score a passing
# similarity match. 0.65 requires roughly OCR confidence >=35% at the
# minimum-acceptable similarity (85) — genuinely weak OCR reads get
# caught, a normal noisy-but-legible read doesn't.
NAME_SCHOOL_CONFIDENCE_FLOOR = 0.65

# Floor for fields that use raw OCR confidence directly (no similarity
# blending) — school_year_match, residency_geofence (barangay),
# cert_year_match. These don't get the combine_confidence() floor, so
# their realistic range starts much lower, and 0.5 is a meaningful cut
# here (not a no-op like it would be for the name/school floor above).
RAW_FIELD_CONFIDENCE_FLOOR = 0.5

def _flag(check_name, reason, extracted=None, raw=None, expected=None, context=None, score=None, metadata=None):
    return {
        "check": check_name, "passed": False, "flagged": True,
        "reason": reason, "extracted": extracted, "raw": raw,
        "expected": expected, "context": context, "score": score,
        "metadata": metadata or {},
    }

def _pass(check_name, extracted=None, raw=None, score=None, context=None, expected=None):
    return {
        "check": check_name, "passed": True, "flagged": False,
        "extracted": extracted, "raw": raw, "score": score, "context": context, "expected": expected
    }

def _check_name_or_reupload(blocks, page_w, page_h, first_name, middle_name, last_name):
    """
    Same extraction as _check_name below, but distinguishes "literally no
    name text found anywhere on the document" from "found something, but
    it doesn't match this applicant". The former routes to auto_reupload
    (treated as a bad/wrong upload — the applicant likely uploaded the
    wrong file, or the shot is cropped/covering the name), instead of
    for_review (a real eligibility judgment call that needs a verifier's
    eyes). Only appropriate where a totally-missing name is itself a
    strong signal something is wrong with the upload — see school_id.py
    for why School ID specifically gets this treatment and other
    document types don't (yet).

    Returns a ("auto_reupload", {category, reason}) tuple when nothing
    was found at all, or ("checked", <normal _pass/_flag dict>) for
    every other outcome (matched, mismatched, or low-confidence match).
    """
    res = extract_name(blocks, page_w, page_h, first_name, middle_name, last_name)
    expected_name = f"{first_name} {middle_name} {last_name}".strip()

    # extract_name's own final fallback returns value=None only when
    # truly nothing scored high enough anywhere on the page — a mismatch
    # (wrong name found) still carries a non-None value, so this check
    # only fires on the "nothing detected at all" case.
    if not res.value:
        return "auto_reupload", {
            "category": "name_not_detected",
            "reason": "We couldn't detect a name on your document. Please make sure it is clearly visible, well-lit, and not cropped or covered, then upload again.",
        }

    if res.found and res.confidence < NAME_SCHOOL_CONFIDENCE_FLOOR:
        return "checked", _flag(
            "name_match",
            f"Name text matched, but the OCR read itself was low-confidence ({res.confidence:.2f}) — please verify manually.",
            extracted=res.value, raw=res.raw, score=res.confidence, context=res.context, expected=expected_name,
        )
    if res.found:
        return "checked", _pass("name_match", extracted=res.value, raw=res.raw, score=res.confidence, context=res.context, expected=expected_name)
    return "checked", _flag("name_match", res.context, extracted=res.value, raw=res.raw, expected=expected_name)


def _check_name(blocks, page_w, page_h, first_name, middle_name, last_name):
    res = extract_name(blocks, page_w, page_h, first_name, middle_name, last_name)
    expected_name = f"{first_name} {middle_name} {last_name}".strip()
    if res.found and res.confidence < NAME_SCHOOL_CONFIDENCE_FLOOR:
        return _flag(
            "name_match",
            f"Name text matched, but the OCR read itself was low-confidence ({res.confidence:.2f}) — please verify manually.",
            extracted=res.value, raw=res.raw, score=res.confidence, context=res.context, expected=expected_name,
        )
    if res.found:
        return _pass("name_match", extracted=res.value, raw=res.raw, score=res.confidence, context=res.context, expected=expected_name)
    return _flag("name_match", res.context, extracted=res.value, raw=res.raw, expected=expected_name)

def _check_school(blocks, page_w, page_h, declared_school):
    res = extract_school(blocks, page_w, page_h, declared_school)
    if res.found and res.confidence < NAME_SCHOOL_CONFIDENCE_FLOOR:
        return _flag(
            "school_match",
            f"School text matched, but the OCR read itself was low-confidence ({res.confidence:.2f}) — please verify manually.",
            extracted=res.value, raw=res.raw, score=res.confidence, context=res.context, expected=declared_school,
        )
    if res.found:
        return _pass("school_match", extracted=res.value, raw=res.raw, score=res.confidence, context=res.context, expected=declared_school)
    return _flag("school_match", res.context, extracted=res.value, raw=res.raw, expected=declared_school)