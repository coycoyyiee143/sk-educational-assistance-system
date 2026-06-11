# app/verification/school_id.py
import re
from app.verification.shared import _pass, _flag, _check_name

def verify_school_id(ocr_result, first_name, middle_name, last_name, declared_school):
    """
    Validates identity consistency and enrollment matching on Student IDs.
    """
    # Flatten all text items from the OCR results
    extracted_text_pool = " ".join([block.text for block in ocr_result]).lower()
    
    # 1. Identity Validation (Uses shared Levenshtein subroutines)
    name_check = _check_name(ocr_result, first_name, middle_name, last_name)
    if not name_check["passed"]:
        return _flag(
            reason="Identity mismatch on Student ID.",
            details=f"Target name components not confidently matched. Score: {name_check['score']}"
        )
        
    # 2. Institutional Validation
    clean_declared_school = declared_school.lower().strip()
    # Handle acronym variations dynamically
    if "pamantasan ng cabuyao" in clean_declared_school or "pnc" in clean_declared_school:
        school_keywords = ["pamantasan", "cabuyao", "pnc"]
    elif "st. vincent" in clean_declared_school or "svcc" in clean_declared_school:
        school_keywords = ["vincent", "svcc", "st."]
    elif "sti" in clean_declared_school:
        school_keywords = ["sti", "calamba"]
    else:
        school_keywords = [clean_declared_school]

    # Verify if any distinct institutional keywords are detected in the image text pool
    school_matched = any(kw in extracted_text_pool for kw in school_keywords)
    
    if not school_matched:
        return _flag(
            reason="Institutional inconsistency on ID card.",
            details=f"Uploaded ID does not contain valid naming conventions for {declared_school}."
        )
        
    return _pass(details="Student identity and institutional registration successfully matched.")
