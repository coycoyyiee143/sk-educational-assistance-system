# app/verification/shared.py
from app.postprocessing import extract_name, extract_school

CONFIDENCE_THRESHOLD = 0.75

def _flag(check_name, reason, extracted=None, raw=None, expected=None, context=None):
    return {
        "check": check_name, "passed": False, "flagged": True,
        "reason": reason, "extracted": extracted, "raw": raw,
        "expected": expected, "context": context
    }

def _pass(check_name, extracted=None, raw=None, score=None, context=None):
    return {
        "check": check_name, "passed": True, "flagged": False,
        "extracted": extracted, "raw": raw, "score": score, "context": context
    }

def _check_name(blocks, page_w, page_h, first_name, middle_name, last_name):
    res = extract_name(blocks, page_w, page_h, first_name, middle_name, last_name)
    if res.found:
        return _pass("name_match", extracted=res.value, raw=res.raw, score=res.confidence, context=res.context)
    return _flag("name_match", res.context, extracted=res.value, raw=res.raw, expected=f"{first_name} {middle_name} {last_name}".strip())

def _check_school(blocks, page_w, page_h, declared_school):
    res = extract_school(blocks, page_w, page_h, declared_school)
    if res.found:
        return _pass("school_match", extracted=res.value, raw=res.raw, score=res.confidence, context=res.context)
    return _flag("school_match", res.context, extracted=res.value, raw=res.raw, expected=declared_school)