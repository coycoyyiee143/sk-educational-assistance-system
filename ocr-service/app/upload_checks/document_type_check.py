# app/upload_checks/document_type_check.py
from typing import List, Optional
from app.models import OcrBlock
from app.template_checks.base_strategy import fuzzy_contains
from app.upload_checks.face_presence import detect_id_photo

# Distinctive markers that should only appear on THAT document type.
# School ID deliberately has NO entry here — its school name text isn't
# a reliable universal marker (it's different per school, unlike
# "voter's certification" or "registration form" which are fixed
# phrases regardless of which applicant/school). School ID's real
# universal marker is the applicant photo instead, checked separately
# below via detect_id_photo() — large and centered on every School ID
# regardless of which school issued it, unlike text that varies.
DOCUMENT_TYPE_MARKERS = {
    "voters_certificate": ["voter's certification", "commission on elections"],
    "registration_form":  ["registration form"],
}

DOCUMENT_TYPE_LABELS = {
    "voters_certificate": "Voter's Certification",
    "registration_form":  "Registration Form",
    "school_id":          "School ID",
}


def check_document_type(blocks: List[OcrBlock], expected_type: str, image_path: Optional[str] = None):
    """
    Upload-check, first line of defense — checked BEFORE any of the
    full, expensive field extraction (name/school/template checks)
    runs. Those are pointless on a document that isn't even the right
    type, and produce confusing, misleading verifier-facing reasons if
    they do. Returns None if no mismatch found, or a dict describing it.

    Two signals combined: text markers for Voter's Cert/Reg Form (each
    has a fixed, universal phrase), and the applicant photo for School
    ID (large + centered, unlike the small/side-positioned biometric
    photo on a Voter's Cert or the complete absence of one on a Reg Form).
    """
    full_text = " ".join(b.text.lower() for b in blocks)

    for other_type, markers in DOCUMENT_TYPE_MARKERS.items():
        if other_type == expected_type:
            continue
        if any(fuzzy_contains(full_text, m, threshold=0.75) for m in markers):
            expected_label = DOCUMENT_TYPE_LABELS.get(expected_type, expected_type)
            other_label = DOCUMENT_TYPE_LABELS.get(other_type, other_type)
            return {
                "reason": f"This looks like a {other_label}, not a {expected_label}. Please upload the correct document type.",
                "detected_type": other_type,
            }

    if image_path:
        photo_result = detect_id_photo(image_path)
        expected_label = DOCUMENT_TYPE_LABELS.get(expected_type, expected_type)

        if expected_type != "school_id" and photo_result.has_large_centered_face:
            return {
                "reason": f"This looks like a School ID, not a {expected_label}. Please upload the correct document type.",
                "detected_type": "school_id",
            }

        if expected_type == "school_id" and not photo_result.has_large_centered_face:
            return {
                "reason": "This doesn't look like a School ID — no clear cardholder photo detected. Please upload a clear photo of your School ID.",
                "detected_type": "unknown",
            }

    return None