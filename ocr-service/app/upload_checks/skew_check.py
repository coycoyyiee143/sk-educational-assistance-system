# app/upload_checks/skew_check.py
import cv2
import logging
from dataclasses import dataclass
from app.utils.image_loading import load_grayscale

logger = logging.getLogger(__name__)

# Kept conservative and unvalidated against real skewed samples -- same
# caveat as MIN_SHARPNESS in image_quality_check.py. PaddleOCR's own
# angle classifier already corrects 0/180-degree flips, and a few
# degrees of ordinary phone-photo tilt doesn't meaningfully hurt fuzzy
# matching's tolerance for OCR noise. This only needs to catch a
# genuinely sideways or heavily-tilted photo, since every region-based
# check in app/utils/spatial.py (header/top_half/etc.) assumes a
# roughly upright page.
MAX_SKEW_DEGREES = 12.0

# Below this many foreground (non-background) pixels, minAreaRect's
# angle is meaningless noise (e.g. a near-blank or unreadable capture) --
# not this check's job to flag, check_image_quality() already covers
# "too blank/blurry to read".
MIN_FOREGROUND_PIXELS = 100


@dataclass
class SkewCheckResult:
    passed: bool
    angle: float


def check_skew(image_path: str) -> SkewCheckResult:
    """
    Estimates rotation via the minimum-area bounding box around every
    foreground (ink/content) pixel after Otsu thresholding -- the
    standard deskew-angle technique. Doesn't need to be precise, only
    needs to catch an image tilted enough to confuse OCR line detection
    and the region-based spatial checks. Fails open on any read/processing
    error.
    """
    try:
        gray = load_grayscale(image_path)
        if gray is None:
            return SkewCheckResult(passed=True, angle=0.0)

        h, w = gray.shape[:2]
        scale = min(1.0, 800 / max(h, w)) if max(h, w) else 1.0
        if scale < 1.0:
            gray = cv2.resize(gray, (int(w * scale), int(h * scale)))

        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        coords = cv2.findNonZero(thresh)
        if coords is None or len(coords) < MIN_FOREGROUND_PIXELS:
            return SkewCheckResult(passed=True, angle=0.0)

        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = 90 + angle
        elif angle > 45:
            angle = angle - 90

        return SkewCheckResult(passed=abs(angle) <= MAX_SKEW_DEGREES, angle=round(float(angle), 2))
    except Exception as e:
        logger.warning("check_skew failed on %s: %s", image_path, e)
        return SkewCheckResult(passed=True, angle=0.0)
