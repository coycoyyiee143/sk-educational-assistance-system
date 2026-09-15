# ocr-service/tests/test_voters_cert_minor.py
"""
Covers the minor-applicant path in verify_voters_certificate(): a minor
must submit their GUARDIAN's Voter's Certificate, not their own, so the
identity check needs to match against the guardian's name instead of
the applicant's.

Run with:
    cd ocr-service
    pip install pytest --break-system-packages   # if not already installed
    python -m pytest tests/test_voters_cert_minor.py -v
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models import OcrBlock
from app.verification import voters_cert as voters_cert_module
from app.verification.voters_cert import verify_voters_certificate


def block(text, confidence=0.92, x_min=50, y_min=100, x_max=400, y_max=125):
    """Small helper so each test only has to specify what actually varies."""
    return OcrBlock(text=text, confidence=confidence, x_min=x_min, y_min=y_min, x_max=x_max, y_max=y_max)


def base_cert_blocks(name_line=None):
    """
    A minimal but realistic Voter's Certification: document-type markers
    (required or check_document_type() short-circuits everything below
    before the name check ever runs) + a Barangay Mamatid line, plus
    whatever name_line the test wants to include (or None to simulate a
    certificate with no readable name at all).
    """
    blocks = [
        block("COMMISSION ON ELECTIONS", y_min=10, y_max=30),
        block("VOTER'S CERTIFICATION", y_min=35, y_max=55),
        block("Barangay: Mamatid", y_min=200, y_max=220),
    ]
    if name_line:
        blocks.append(block(name_line, y_min=100, y_max=125))
    return blocks


AVG_CONFIDENCE = 0.9  # comfortably above CONFIDENCE_THRESHOLD (0.75)


def test_minor_without_guardian_info_flags_identity_match_not_auto_reupload():
    """
    A minor with no guardian info on file at all should be routed to
    for_review (identity_match flagged with an explanatory reason) —
    NOT auto_reupload, since this isn't about the uploaded file being
    wrong, it's about missing profile data the applicant needs to fill
    in separately. This branch checks guardian_first_name/last_name
    BEFORE ever touching the OCR blocks, so no mock blocks are needed
    here — an empty ocr_result is enough to reach it.
    """
    result = verify_voters_certificate(
        ocr_result=[],
        avg_confidence=AVG_CONFIDENCE,
        first_name="Miguel", middle_name="Ramos", last_name="Santos",
        is_minor=True,
        guardian_first_name=None, guardian_middle_name=None, guardian_last_name=None,
        declared_school=None,
    )
    assert result["flag_reason"] != "auto_reupload"
    assert result["checks"]["identity_match"]["passed"] is False
    assert "guardian" in result["checks"]["identity_match"]["reason"].lower()


def test_minor_with_guardian_info_and_matching_name_passes(monkeypatch):
    """
    Minor applicant, complete guardian info on file, and the certificate
    shows the GUARDIAN's name (not the applicant's own) — identity_match
    should pass, matched against guardian_first/middle/last_name.
    """
    blocks = base_cert_blocks("Name: Elena Marie Santos")
    monkeypatch.setattr(voters_cert_module, "parse_ocr_blocks", lambda ocr_result: blocks)

    result = verify_voters_certificate(
        ocr_result=[],
        avg_confidence=AVG_CONFIDENCE,
        first_name="Miguel", middle_name="Ramos", last_name="Santos",
        is_minor=True,
        guardian_first_name="Elena", guardian_middle_name="Marie", guardian_last_name="Santos",
        declared_school=None,
    )
    assert result["flag_reason"] != "auto_reupload"
    assert result["checks"]["identity_match"]["passed"] is True
    assert "Elena" in result["checks"]["identity_match"]["extracted"]


def test_minor_with_guardian_info_but_cert_shows_applicants_own_name(monkeypatch):
    """
    Minor applicant, complete guardian info on file, but the uploaded
    certificate confidently shows the APPLICANT's own name instead of
    the guardian's (e.g. they mistakenly uploaded their own Voter's
    Cert instead of their guardian's). A "Name:" label was found and
    read reliably, it just isn't the guardian -- this is the same
    confident-mismatch tier as name_mismatch on any other document,
    just checked against the guardian instead of the applicant (see
    AUTO_REUPLOAD_VERIFICATION_RULES.md's guardian variant). Most
    likely an honest wrong-document mistake, fixable by reuploading --
    auto_reupload, not verifier.
    """
    blocks = base_cert_blocks("Name: Miguel Ramos Santos")
    monkeypatch.setattr(voters_cert_module, "parse_ocr_blocks", lambda ocr_result: blocks)

    result = verify_voters_certificate(
        ocr_result=[],
        avg_confidence=AVG_CONFIDENCE,
        first_name="Miguel", middle_name="Ramos", last_name="Santos",
        is_minor=True,
        guardian_first_name="Elena", guardian_middle_name="Marie", guardian_last_name="Santos",
        declared_school=None,
    )
    assert result["flag_reason"] == "auto_reupload"
    assert result["auto_reupload_category"] == "name_mismatch"
    assert "guardian" in result["auto_reupload_reason"]


def test_minor_with_guardian_info_but_no_name_detected_at_all_triggers_auto_reupload(monkeypatch):
    """
    Minor applicant, complete guardian info on file, but the uploaded
    certificate has no readable name text anywhere (blank/cropped/wrong
    file entirely). This should short-circuit to auto_reupload via
    _check_name_or_reupload, since nothing at all being found is a
    strong signal the upload itself is bad — not a judgment call.
    """
    blocks = base_cert_blocks(name_line=None)
    monkeypatch.setattr(voters_cert_module, "parse_ocr_blocks", lambda ocr_result: blocks)

    result = verify_voters_certificate(
        ocr_result=[],
        avg_confidence=AVG_CONFIDENCE,
        first_name="Miguel", middle_name="Ramos", last_name="Santos",
        is_minor=True,
        guardian_first_name="Elena", guardian_middle_name="Marie", guardian_last_name="Santos",
        declared_school=None,
    )
    assert result["flag_reason"] == "auto_reupload"
    assert result["auto_reupload_category"] == "name_not_detected"