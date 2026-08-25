from flask import Blueprint, request, jsonify
from app.ocr_engine import run_ocr, get_average_confidence, get_ocr
from app.verification import (
    verify_voters_certificate,
    verify_registration_form,
    verify_school_id
)
from app.forgery.ela import compute_ela, describe_ela_score
from app.forgery.pdf_metadata import check_pdf_metadata, describe_pdf_metadata_score
import tempfile
import os

bp = Blueprint("ocr", __name__, url_prefix="/api/ocr")


def save_temp_image(file) -> str:
    suffix = os.path.splitext(file.filename)[1] or '.jpg'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        file.save(tmp.name)
        return tmp.name
    

def get_name_fields(form) -> tuple:
    return (
        form.get("first_name", ""),
        form.get("middle_name", ""),
        form.get("last_name", "")
    )


@bp.route("/voters-certificate", methods=["POST"])
def process_voters_certificate():
    tmp_path = None
    try:
        if "file" not in request.files:
            return jsonify({"success": False, "error": "No file uploaded"}), 400
        tmp_path = save_temp_image(request.files["file"])
        first_name, middle_name, last_name = get_name_fields(request.form)
        enforce_cert_year = request.form.get("enforce_cert_year", "false").lower() == "true"
        configured_cert_year = request.form.get("cert_year", None)
        is_minor = request.form.get("is_minor", "0") == "1"
        guardian_first_name = request.form.get("guardian_first_name", "") or None
        guardian_middle_name = request.form.get("guardian_middle_name", "") or None
        guardian_last_name = request.form.get("guardian_last_name", "") or None
        ocr_result = run_ocr(tmp_path)
        avg_confidence = get_average_confidence(ocr_result)
        verification = verify_voters_certificate(
            ocr_result, avg_confidence,
            first_name, middle_name, last_name,
            enforce_cert_year, configured_cert_year,
            is_minor=is_minor,
            guardian_first_name=guardian_first_name,
            guardian_middle_name=guardian_middle_name,
            guardian_last_name=guardian_last_name
        )
        # ELA runs on the raw image file, separate from OCR/text-based
        # verification above — must happen before tmp_path is deleted below.
        ela_result = compute_ela(tmp_path)
        forgery_check = {
            "check": "image_integrity",
            "passed": ela_result.passed,
            "flagged": not ela_result.passed,
            "extracted": describe_ela_score(ela_result.score),
            "reason": "; ".join(ela_result.flags) if ela_result.flags else None,
            "score": ela_result.score,
        }
        verification["checks"]["image_integrity"] = forgery_check
        if not ela_result.passed:
            verification["flagged"] = True
            verification["flag_reason"] = "eligibility_issues"

        # PDF authoring-tool metadata check — flags documents created in
        # general-purpose design software (Canva, Photoshop, etc.) rather
        # than scanned or exported from a school system. Silent/passes on
        # non-PDF uploads.
        applicant_full_name = f"{first_name} {last_name}".strip()
        pdf_meta_result = check_pdf_metadata(tmp_path, applicant_full_name)
        pdf_meta_check = {
            "check": "document_origin",
            "passed": pdf_meta_result.passed,
            "flagged": not pdf_meta_result.passed,
            "extracted": describe_pdf_metadata_score(pdf_meta_result.score),
            "reason": "; ".join(pdf_meta_result.flags) if pdf_meta_result.flags else None,
            "score": pdf_meta_result.score,
        }
        verification["checks"]["document_origin"] = pdf_meta_check
        if not pdf_meta_result.passed:
            verification["flagged"] = True
            verification["flag_reason"] = "eligibility_issues"

        formatted_ocr = [{"text": b["text"], "confidence": b["confidence"]} for b in ocr_result]
        return jsonify({
            "success": True,
            "ocr_lines": formatted_ocr,
            "avg_confidence": avg_confidence,
            "verification": verification
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@bp.route("/registration-form", methods=["POST"])
def process_registration_form():
    tmp_path = None
    try:
        if "file" not in request.files:
            return jsonify({"success": False, "error": "No file uploaded"}), 400
        
        tmp_path = save_temp_image(request.files["file"])
        first_name, middle_name, last_name = get_name_fields(request.form)
        declared_school = request.form.get("declared_school", "")
        configured_school_year = request.form.get("school_year", "")
        ocr_result = run_ocr(tmp_path)
        avg_confidence = get_average_confidence(ocr_result)
        verification = verify_registration_form(
            ocr_result, avg_confidence,
            first_name, middle_name, last_name,
            declared_school,
            configured_school_year
        )
        # ELA runs on the raw image file, separate from OCR/text-based
        # verification above — must happen before tmp_path is deleted below.
        ela_result = compute_ela(tmp_path)
        forgery_check = {
            "check": "image_integrity",
            "passed": ela_result.passed,
            "flagged": not ela_result.passed,
            "extracted": describe_ela_score(ela_result.score),
            "reason": "; ".join(ela_result.flags) if ela_result.flags else None,
            "score": ela_result.score,
        }
        verification["checks"]["image_integrity"] = forgery_check
        if not ela_result.passed:
            verification["flagged"] = True
            verification["flag_reason"] = "eligibility_issues"

        # PDF authoring-tool metadata check — flags documents created in
        # general-purpose design software (Canva, Photoshop, etc.) rather
        # than scanned or exported from a school system. Silent/passes on
        # non-PDF uploads.
        pdf_meta_result = check_pdf_metadata(tmp_path)
        pdf_meta_check = {
            "check": "document_origin",
            "passed": pdf_meta_result.passed,
            "flagged": not pdf_meta_result.passed,
            "extracted": describe_pdf_metadata_score(pdf_meta_result.score),
            "reason": "; ".join(pdf_meta_result.flags) if pdf_meta_result.flags else None,
            "score": pdf_meta_result.score,
        }
        verification["checks"]["document_origin"] = pdf_meta_check
        if not pdf_meta_result.passed:
            verification["flagged"] = True
            verification["flag_reason"] = "eligibility_issues"

        formatted_ocr = [{"text": b["text"], "confidence": b["confidence"]} for b in ocr_result]
        return jsonify({
            "success": True,
            "ocr_lines": formatted_ocr,
            "avg_confidence": avg_confidence,
            "verification": verification
        })
    
    except Exception as e:
        import traceback
        return jsonify({"success": False, "error": str(e), "traceback": traceback.format_exc()}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@bp.route("/school-id", methods=["POST"])
def process_school_id():
    tmp_path = None
    try:
        if "file" not in request.files:
            return jsonify({"success": False, "error": "No file uploaded"}), 400
        
        tmp_path = save_temp_image(request.files["file"])
        first_name, middle_name, last_name = get_name_fields(request.form)
        declared_school = request.form.get("declared_school", "")
        ocr_result = run_ocr(tmp_path)
        avg_confidence = get_average_confidence(ocr_result)
        verification = verify_school_id(
            ocr_result, avg_confidence,
            first_name, middle_name, last_name,
            declared_school
        )
        # ELA runs on the raw image file, separate from OCR/text-based
        # verification above — must happen before tmp_path is deleted below.
        ela_result = compute_ela(tmp_path)
        forgery_check = {
            "check": "image_integrity",
            "passed": ela_result.passed,
            "flagged": not ela_result.passed,
            "extracted": describe_ela_score(ela_result.score),
            "reason": "; ".join(ela_result.flags) if ela_result.flags else None,
            "score": ela_result.score,
        }
        verification["checks"]["image_integrity"] = forgery_check
        if not ela_result.passed:
            verification["flagged"] = True
            verification["flag_reason"] = "eligibility_issues"

        # PDF authoring-tool metadata check — flags documents created in
        # general-purpose design software (Canva, Photoshop, etc.) rather
        # than scanned or exported from a school system. Silent/passes on
        # non-PDF uploads.
        pdf_meta_result = check_pdf_metadata(tmp_path)
        pdf_meta_check = {
            "check": "document_origin",
            "passed": pdf_meta_result.passed,
            "flagged": not pdf_meta_result.passed,
            "extracted": describe_pdf_metadata_score(pdf_meta_result.score),
            "reason": "; ".join(pdf_meta_result.flags) if pdf_meta_result.flags else None,
            "score": pdf_meta_result.score,
        }
        verification["checks"]["document_origin"] = pdf_meta_check
        if not pdf_meta_result.passed:
            verification["flagged"] = True
            verification["flag_reason"] = "eligibility_issues"

        formatted_ocr = [{"text": b["text"], "confidence": b["confidence"]} for b in ocr_result]
        return jsonify({
            "success": True,
            "ocr_lines": formatted_ocr,
            "avg_confidence": avg_confidence,
            "verification": verification
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path): 
            os.unlink(tmp_path)


@bp.route("/debug", methods=["POST"])
def debug_ocr():
    tmp_path = None
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file"}), 400
        tmp_path = save_temp_image(request.files["file"])
        
        ocr = get_ocr()
        results = ocr.ocr(tmp_path, cls=True)
        
        debug_info = []
        if results and results[0]:
            for i, line in enumerate(results[0]):
                debug_info.append({
                    "index": i,
                    "text": line[1][0],
                    "confidence": float(line[1][1]),
                    "bbox": line[0]
                })
        
        return jsonify({"results": debug_info})
    except Exception as e:
        import traceback
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})