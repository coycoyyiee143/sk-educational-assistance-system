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

# Threshold for treating a "found a Name field, but it doesn't match
# this applicant" read as confident enough to auto-reupload rather
# than route to a verifier. Deliberately reuses CONFIDENCE_THRESHOLD
# rather than introducing a new number — this is already the bar the
# system uses elsewhere to decide "this OCR read is reliable enough to
# act on automatically." Below this, the label/value itself wasn't
# read reliably enough to trust the mismatch, so it stays
# verifier-routed instead (could be a bad scan of the right document,
# not proof of the wrong one). See AUTO_REUPLOAD_VERIFICATION_RULES.md.
CONFIDENT_MISMATCH_THRESHOLD = CONFIDENCE_THRESHOLD

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

def _check_name_or_reupload(blocks, page_w, page_h, first_name, middle_name, last_name, subject_label="your registered name"):
    """
    Same underlying extraction as _check_name, but distinguishes a
    CONFIDENT mismatch from a genuinely AMBIGUOUS one:

    - CONFIDENT mismatch: a "Name" field was found on the document and
      read reliably (method == "label_anchored_no_match", confidence
      >= CONFIDENT_MISMATCH_THRESHOLD), but it simply isn't this
      applicant. Most likely explanation is an honest mistaken upload
      (wrong file, someone else's document) — auto-reupload candidate.
    - AMBIGUOUS: no name label found at all, OR the label/value itself
      was read too unreliably to trust the mismatch. Could be a bad
      scan of the actually-correct document — stays verifier-routed.

    See AUTO_REUPLOAD_VERIFICATION_RULES.md for the full reasoning.

    subject_label describes WHOSE name is being checked, for the
    applicant-facing auto_reupload message — e.g. "your registered
    name" for the applicant's own name check, or "your guardian's name
    on file" for the guardian-name check on a minor's voter's
    certificate. Saying "your registered name" on a guardian mismatch
    would be wrong (it's the guardian's name that didn't match, not
    the applicant's), so callers checking a guardian name MUST pass
    the guardian-specific label.

    Returns a tuple: ("auto_reupload", {"category": ..., "reason": ...})
    or ("check", check_dict) — callers branch on the first element.
    """
    res = extract_name(blocks, page_w, page_h, first_name, middle_name, last_name)
    expected_name = f"{first_name} {middle_name} {last_name}".strip()

    if res.found and res.confidence < NAME_SCHOOL_CONFIDENCE_FLOOR:
        return "check", _flag(
            "name_match",
            f"Name text matched, but the OCR read itself was low-confidence ({res.confidence:.2f}) — please verify manually.",
            extracted=res.value, raw=res.raw, score=res.confidence, context=res.context, expected=expected_name,
        )

    if res.found:
        return "check", _pass("name_match", extracted=res.value, raw=res.raw, score=res.confidence, context=res.context, expected=expected_name)

    if res.method == "label_anchored_no_match" and res.confidence >= CONFIDENT_MISMATCH_THRESHOLD:
        return "auto_reupload", {
            "category": "name_mismatch",
            "reason": f"The name on this document doesn't match {subject_label}. Please make sure you're uploading the correct document and try again.",
        }

    return "check", _flag("name_match", res.context, extracted=res.value, raw=res.raw, expected=expected_name)


def _check_name(blocks, page_w, page_h, first_name, middle_name, last_name):
    # Thin wrapper kept for any caller that only wants the check-dict
    # shape and doesn't need to branch on auto-reupload eligibility.
    _, result = _check_name_or_reupload(blocks, page_w, page_h, first_name, middle_name, last_name)
    return result

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