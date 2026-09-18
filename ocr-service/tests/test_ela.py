# tests/test_ela.py
#
# Unit tests for app.forgery.ela — Error Level Analysis.
#
# compute_ela()'s main path does real PIL image resave/diff work against
# an actual file on disk, which is outside this scope (real image bytes).
# Only two pure/isolable pieces are tested here:
#   1. describe_ela_score() -- pure numeric-threshold -> label mapping.
#   2. compute_ela()'s documented fail-open behavior when the image can't
#      be opened at all (Image.open raising) -- this is decision logic
#      (must not block a legit applicant over a code/format error), not
#      actual image processing, and is cheap to exercise by monkeypatching
#      PIL.Image.open.
import pytest

from app.forgery import ela


# ── describe_ela_score() ────────────────────────────────────────────────

def test_describe_score_no_artifacts_at_boundary():
    assert ela.describe_ela_score(0.8) == "No Significant Edit Artifacts Detected"


def test_describe_score_no_artifacts_above_boundary():
    assert ela.describe_ela_score(1.0) == "No Significant Edit Artifacts Detected"


def test_describe_score_minor_irregularities():
    assert ela.describe_ela_score(0.6) == "Minor Compression Irregularities Detected"
    assert ela.describe_ela_score(0.79) == "Minor Compression Irregularities Detected"


def test_describe_score_moderate_artifacts():
    assert ela.describe_ela_score(0.4) == "Moderate Edit Artifacts Detected"
    assert ela.describe_ela_score(0.59) == "Moderate Edit Artifacts Detected"


def test_describe_score_significant_artifacts():
    assert ela.describe_ela_score(0.0) == "Significant Edit Artifacts Detected"
    assert ela.describe_ela_score(0.39) == "Significant Edit Artifacts Detected"


# ── compute_ela() fail-open behavior ──────────────────────────────────────

def test_compute_ela_fails_open_when_image_cannot_be_opened(monkeypatch):
    def raise_open(*args, **kwargs):
        raise OSError("cannot identify image file")

    monkeypatch.setattr(ela.Image, "open", raise_open)
    result = ela.compute_ela("nonexistent_or_corrupt.jpg")
    assert result.passed is True
    assert result.flags == []
    assert result.score == pytest.approx(1.0)
