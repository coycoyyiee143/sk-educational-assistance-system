# ocr-service/app/upload_checks/image_quality_check.py
import cv2
import logging
from dataclasses import dataclass
from app.utils.image_loading import load_grayscale

logger = logging.getLogger(__name__)

MIN_SHARPNESS = 150


@dataclass
class ImageQualityResult:
    passed: bool
    variance: float


def check_image_quality(image_path: str) -> ImageQualityResult:
    """
    Doesn't need to be a perfect quality gate — existing fuzzy matching
    already tolerates a reasonable amount of OCR noise from an imperfect
    but still-readable photo. This exists to catch the clearly-too-blurry
    case before it wastes a full OCR/verification pass.

    Handles both plain images AND PDFs — a scanned document (e.g. via
    CamScanner or similar) saved as PDF gets its first page rendered to
    an image before measuring, since a blurry scan saved as PDF is a
    completely normal, legitimate upload path that previously received
    zero quality checking at all.

    Fails open (treated as passed) on any read/processing error.
    """
    try:
        gray = load_grayscale(image_path)
        if gray is None:
            return ImageQualityResult(passed=True, variance=0.0)

        h, w = gray.shape[:2]
        scale = min(1.0, 600 / max(h, w))
        if scale < 1.0:
            gray = cv2.resize(gray, (int(w * scale), int(h * scale)))

        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
        return ImageQualityResult(passed=variance >= MIN_SHARPNESS, variance=round(float(variance), 2))
    except Exception as e:
        logger.warning("check_image_quality failed on %s: %s", image_path, e)
        return ImageQualityResult(passed=True, variance=0.0)