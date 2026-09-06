# ocr-service/app/upload_checks/image_quality_check.py
import cv2
import numpy as np
import logging
import os
from dataclasses import dataclass

logger = logging.getLogger(__name__)

MIN_SHARPNESS = 150


@dataclass
class ImageQualityResult:
    passed: bool
    variance: float


def _load_as_grayscale(image_path: str):
    """
    Returns a grayscale numpy array for either a plain image file OR the
    first page of a PDF (rendered to an image in memory via PyMuPDF).
    Returns None if the file can't be read as either.
    """
    ext = os.path.splitext(image_path)[1].lower()

    if ext == ".pdf":
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(image_path)
            page = doc.load_page(0)
            # 150 DPI is enough detail for a sharpness measurement without
            # being unnecessarily slow to render.
            pix = page.get_pixmap(dpi=150)
            img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            doc.close()
            if pix.n == 4:
                return cv2.cvtColor(img_array, cv2.COLOR_RGBA2GRAY)
            elif pix.n == 3:
                return cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            else:
                return img_array[:, :, 0]
        except Exception as e:
            logger.warning("Could not render PDF for quality check %s: %s", image_path, e)
            return None

    img = cv2.imread(image_path)
    if img is None:
        return None
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


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
        gray = _load_as_grayscale(image_path)
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