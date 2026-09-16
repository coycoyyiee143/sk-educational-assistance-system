"""Unit tests for app.forgery.image_metadata — pure decision logic only.

C2PA-reading behavior is exercised by monkeypatching app.forgery.image_metadata's
c2pa module reference directly, so these tests don't depend on the optional
`c2pa` package being installed in the environment.
"""
from types import SimpleNamespace

import pytest

from app.forgery import image_metadata as im


# ── describe_image_metadata_score() ─────────────────────────────────

def test_describe_score_perfect_score_is_no_signals_detected():
    assert im.describe_image_metadata_score(1.0) == "No AI-Generation Provenance Signals Detected"


def test_describe_score_above_one_is_still_no_signals_detected():
    assert im.describe_image_metadata_score(1.5) == "No AI-Generation Provenance Signals Detected"


def test_describe_score_below_one_is_signals_detected():
    assert im.describe_image_metadata_score(0.99) == "AI-Generation or Editing Signals Detected"


def test_describe_score_zero_is_signals_detected():
    assert im.describe_image_metadata_score(0.0) == "AI-Generation or Editing Signals Detected"


# ── _check_filename() ────────────────────────────────────────────────

def test_check_filename_flags_known_ai_pattern():
    flags = im._check_filename("Gemini_Generated_Image_ab12.png")
    assert len(flags) == 1
    assert "Gemini_Generated_Image_ab12.png" in flags[0]


def test_check_filename_is_case_insensitive():
    flags = im._check_filename("CHATGPT_IMAGE_2026.png")
    assert len(flags) == 1


def test_check_filename_no_match_for_ordinary_name():
    assert im._check_filename("IMG_20260914_123456.jpg") == []


def test_check_filename_none_returns_empty():
    assert im._check_filename(None) == []


def test_check_filename_empty_string_returns_empty():
    assert im._check_filename("") == []


# ── _check_c2pa() ─────────────────────────────────────────────────────

def test_check_c2pa_returns_empty_when_c2pa_not_available(monkeypatch):
    monkeypatch.setattr(im, "C2PA_AVAILABLE", False)
    assert im._check_c2pa("some/path.jpg") == []


def test_check_c2pa_flags_known_tool_signature(monkeypatch):
    monkeypatch.setattr(im, "C2PA_AVAILABLE", True)

    class FakeReader:
        def __init__(self, path):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def json(self):
            return '{"claim_generator": "Adobe Firefly 2.0"}'

    monkeypatch.setattr(im, "c2pa", SimpleNamespace(Reader=FakeReader), raising=False)
    flags = im._check_c2pa("some/path.jpg")
    assert len(flags) == 1
    assert "Adobe Firefly" in flags[0]


def test_check_c2pa_no_flags_when_manifest_has_no_known_signature(monkeypatch):
    monkeypatch.setattr(im, "C2PA_AVAILABLE", True)

    class FakeReader:
        def __init__(self, path):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def json(self):
            return '{"claim_generator": "Canon EOS R5"}'

    monkeypatch.setattr(im, "c2pa", SimpleNamespace(Reader=FakeReader), raising=False)
    assert im._check_c2pa("some/path.jpg") == []


def test_check_c2pa_fails_open_when_no_manifest_present(monkeypatch):
    monkeypatch.setattr(im, "C2PA_AVAILABLE", True)

    class FakeReader:
        def __init__(self, path):
            raise RuntimeError("no manifest found")

    monkeypatch.setattr(im, "c2pa", SimpleNamespace(Reader=FakeReader), raising=False)
    assert im._check_c2pa("some/path.jpg") == []


# ── check_image_metadata() ────────────────────────────────────────────

def test_check_image_metadata_pdf_always_passes(monkeypatch):
    monkeypatch.setattr(im, "C2PA_AVAILABLE", True)
    result = im.check_image_metadata("document.PDF", original_filename="gemini_generated_image.pdf")
    assert result.passed is True
    assert result.flags == []
    assert result.score == 1.0


def test_check_image_metadata_clean_image_passes(monkeypatch):
    monkeypatch.setattr(im, "C2PA_AVAILABLE", False)
    result = im.check_image_metadata("id_photo.jpg", original_filename="IMG_20260914.jpg")
    assert result.passed is True
    assert result.flags == []
    assert result.score == 1.0


def test_check_image_metadata_filename_flag_only_docks_point_two(monkeypatch):
    monkeypatch.setattr(im, "C2PA_AVAILABLE", False)
    result = im.check_image_metadata("photo.jpg", original_filename="midjourney_output_01.jpg")
    assert result.passed is False
    assert len(result.flags) == 1
    assert result.score == pytest.approx(0.8)


def test_check_image_metadata_c2pa_flag_docks_point_eight(monkeypatch):
    monkeypatch.setattr(im, "C2PA_AVAILABLE", True)

    class FakeReader:
        def __init__(self, path):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def json(self):
            return '{"claim_generator": "OpenAI"}'

    monkeypatch.setattr(im, "c2pa", SimpleNamespace(Reader=FakeReader), raising=False)
    result = im.check_image_metadata("photo.jpg", original_filename="IMG_1234.jpg")
    assert result.passed is False
    assert len(result.flags) == 1
    assert result.score == pytest.approx(0.2)


def test_check_image_metadata_both_flags_score_floors_at_zero(monkeypatch):
    monkeypatch.setattr(im, "C2PA_AVAILABLE", True)

    class FakeReader:
        def __init__(self, path):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def json(self):
            return '{"claim_generator": "Google Gemini"}'

    monkeypatch.setattr(im, "c2pa", SimpleNamespace(Reader=FakeReader), raising=False)
    result = im.check_image_metadata("photo.jpg", original_filename="gemini_generated_image.jpg")
    assert result.passed is False
    assert len(result.flags) == 2
    assert result.score == pytest.approx(0.0)
