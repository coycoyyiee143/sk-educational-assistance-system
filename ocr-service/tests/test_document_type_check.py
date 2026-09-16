# tests/test_document_type_check.py
#
# Unit tests for app.upload_checks.document_type_check.check_document_type
# — the text-marker + photo-presence upload-time document type guard.
#
# The photo-presence signal (detect_id_photo) requires a real image and
# cv2's face cascade, so it's monkeypatched with a fake result here rather
# than exercised for real — only the pure decision logic in
# check_document_type() itself is under test.

import pytest
from types import SimpleNamespace

from app.models import OcrBlock
from app.upload_checks import document_type_check as dtc


def block(text, conf=0.9):
    return OcrBlock(text=text, confidence=conf, x_min=0, y_min=0, x_max=200, y_max=20)


def fake_photo_result(has_face: bool):
    return SimpleNamespace(has_large_centered_face=has_face, face_count=1 if has_face else 0,
                            largest_face_area_ratio=0.1 if has_face else 0.0)


# ── text-marker detection ───────────────────────────────────────────────

def test_no_mismatch_for_correctly_typed_voters_certificate():
    blocks = [block("Voter's Certification"), block("Commission on Elections")]
    result = dtc.check_document_type(blocks, "voters_certificate")
    assert result is None


def test_flags_registration_form_uploaded_as_voters_certificate():
    blocks = [block("Registration Form"), block("Office of the University Registrar")]
    result = dtc.check_document_type(blocks, "voters_certificate")
    assert result is not None
    assert result["detected_type"] == "registration_form"
    assert "Registration Form" in result["reason"]
    assert "Voter's Certification" in result["reason"]


def test_flags_voters_certificate_uploaded_as_registration_form():
    blocks = [block("Voter's Certification"), block("Commission on Elections")]
    result = dtc.check_document_type(blocks, "registration_form")
    assert result is not None
    assert result["detected_type"] == "voters_certificate"


def test_does_not_false_positive_on_partial_word_overlap(monkeypatch):
    # "Registration Type" shares only the word "registration" with
    # "registration form" -- must not trigger at the 0.9 marker threshold
    monkeypatch.setattr(dtc, "detect_id_photo", lambda path: fake_photo_result(False))
    blocks = [block("Voter's Certification"), block("Registration Type: New")]
    result = dtc.check_document_type(blocks, "voters_certificate", image_path="dummy.jpg")
    assert result is None


def test_school_id_has_no_text_marker_check():
    # school_id isn't in DOCUMENT_TYPE_MARKERS, so uploading it as the
    # expected type produces no text-based mismatch on its own
    blocks = [block("Some School Name"), block("Student ID")]
    result = dtc.check_document_type(blocks, "school_id")
    assert result is None


# ── photo-presence detection (image_path branch) ─────────────────────────

def test_flags_school_id_photo_when_voters_cert_expected(monkeypatch):
    monkeypatch.setattr(dtc, "detect_id_photo", lambda path: fake_photo_result(True))
    blocks = [block("Some unrelated text")]
    result = dtc.check_document_type(blocks, "voters_certificate", image_path="photo.jpg")
    assert result is not None
    assert result["detected_type"] == "school_id"


def test_school_id_expected_with_face_detected_passes(monkeypatch):
    monkeypatch.setattr(dtc, "detect_id_photo", lambda path: fake_photo_result(True))
    blocks = [block("Some School ID text")]
    result = dtc.check_document_type(blocks, "school_id", image_path="photo.jpg")
    assert result is None


def test_school_id_expected_without_face_flags_unknown(monkeypatch):
    monkeypatch.setattr(dtc, "detect_id_photo", lambda path: fake_photo_result(False))
    blocks = [block("Some text with no photo")]
    result = dtc.check_document_type(blocks, "school_id", image_path="photo.jpg")
    assert result is not None
    assert result["detected_type"] == "unknown"
    assert "School ID" in result["reason"]


def test_no_image_path_skips_photo_check_entirely(monkeypatch):
    # detect_id_photo should never even be called when image_path is None
    called = []
    monkeypatch.setattr(dtc, "detect_id_photo", lambda path: called.append(path) or fake_photo_result(True))
    blocks = [block("Neutral text")]
    result = dtc.check_document_type(blocks, "voters_certificate", image_path=None)
    assert result is None
    assert called == []


def test_text_marker_mismatch_takes_priority_over_photo_check(monkeypatch):
    # a text-marker mismatch should short-circuit before the photo check runs
    called = []
    monkeypatch.setattr(dtc, "detect_id_photo", lambda path: called.append(path) or fake_photo_result(False))
    blocks = [block("Registration Form")]
    result = dtc.check_document_type(blocks, "voters_certificate", image_path="photo.jpg")
    assert result is not None
    assert result["detected_type"] == "registration_form"
    assert called == []
