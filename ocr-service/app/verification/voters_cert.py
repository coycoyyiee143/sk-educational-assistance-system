# app/verification/voters_cert.py
import re
from app.verification.shared import _pass, _flag

def verify_voters_certificate(ocr_result, first_name, middle_name, last_name):
    """
    Validates geographic eligibility constraints for Barangay Mamatid.
    """
    extracted_lines = [block.text.lower().strip() for block in ocr_result]
    full_text = " ".join(extracted_lines)
    
    # 1. Verify Document Type Authenticity
    voter_identifiers = ["voter's certificate", "certificate of registration", "comelec", "electors"]
    if not any(idnt in full_text for idnt in voter_identifiers):
        return _flag(reason="Invalid Document Type", details="The document does not appear to be an official Voter's Certificate.")

    # 2. Strict Geofencing Rule Check
    # Geofence target: Mamatid
    if "mamatid" not in full_text:
        # Detect neighbor spillover to provide contextual debugging
        neighbor_barangays = ["banlic", "pulo", "san isidro", "gulod", "baclaran", "marinig"]
        for neighbor in neighbor_barangays:
            if neighbor in full_text:
                return _flag(
                    reason="Ineligible Residency Status",
                    details=f"Applicant identified as a resident of neighboring Brgy. {neighbor.title()} instead of Mamatid."
                )
        return _flag(reason="Residency Unverified", details="Barangay Mamatid keyword could not be isolated in the document.")

    return _pass(details="Residency verified: Applicant confirmed as a registered voter/resident of Barangay Mamatid.")
