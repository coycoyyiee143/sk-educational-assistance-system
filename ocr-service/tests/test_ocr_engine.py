# tests/test_ocr_engine.py
#
# Unit tests for app.ocr_engine._has_uplb_header — the pure text-check
# used to decide whether ensure_uplb_reg_form_header() needs to retry
# OCR on an enhanced image. Doesn't exercise ensure_uplb_reg_form_header
# itself since that requires a real image and a loaded PaddleOCR model.

from app.ocr_engine import _has_uplb_header


def block(text, conf=0.99):
    return {"text": text, "confidence": conf}


def test_has_uplb_header_true_when_banos_present():
    blocks = [block("UP FORM 5. UNIVERSITY OF THE PHILIPPINES LOS BANOS CERTIFICATE OF REGISTRATION")]
    assert _has_uplb_header(blocks) is True


def test_has_uplb_header_true_with_accented_banos():
    blocks = [block("Los Baños")]
    assert _has_uplb_header(blocks) is True


def test_has_uplb_header_false_when_only_generic_philippines_mention_present():
    # Real bug, confirmed on a real UPLB reg form sample: the student
    # pledge paragraph text also genuinely contains "University of the
    # Philippines System", which a "PHILIPPINES"-only check would wrongly
    # treat as the real header being present, silently skipping the
    # retry that recovers it. "Baños" only ever appears in the real
    # header/campus name, nowhere else on the page.
    blocks = [
        block("In consideration of my admission to the University of the Philippines System (UP) and of the privileges of a student in this institution, I"),
        block("COLLEGE"),
        block("PROGRAM"),
    ]
    assert _has_uplb_header(blocks) is False


def test_has_uplb_header_false_on_empty_blocks():
    assert _has_uplb_header([]) is False
