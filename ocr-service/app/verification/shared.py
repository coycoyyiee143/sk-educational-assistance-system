# app/verification/shared.py
from app.extraction import extract_name, extract_school

CONFIDENCE_THRESHOLD = 0.75

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

def _check_name(blocks, page_w, page_h, first_name, middle_name, last_name):
    res = extract_name(blocks, page_w, page_h, first_name, middle_name, last_name)
    expected_name = f"{first_name} {middle_name} {last_name}".strip()
    if res.found:
        return _pass("name_match", extracted=res.value, raw=res.raw, score=res.confidence, context=res.context, expected=expected_name)
    return _flag("name_match", res.context, extracted=res.value, raw=res.raw, expected=expected_name)

def _check_school(blocks, page_w, page_h, declared_school):
    res = extract_school(blocks, page_w, page_h, declared_school)
    if res.found:
        return _pass("school_match", extracted=res.value, raw=res.raw, score=res.confidence, context=res.context, expected=declared_school)
    return _flag("school_match", res.context, extracted=res.value, raw=res.raw, expected=declared_school)