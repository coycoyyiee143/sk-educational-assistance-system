# app/upload_checks/glare_check.py
import logging
from dataclasses import dataclass
from app.utils.image_loading import load_grayscale

logger = logging.getLogger(__name__)

# Fraction of pixels that must sit at/near full white (>=250 on a 0-255
# grayscale scale) before treating the image as glare/overexposure-blown.
# A paper-white document background routinely lands in the 200-240 range
# under normal lighting without clipping; a genuine specular reflection
# (flash off a laminated ID) or overexposed capture clips a meaningfully
# large area to true white, wiping out whatever text/photo sat underneath.
#
# Unvalidated against real flagged samples yet -- same caveat as
# MIN_SHARPNESS in image_quality_check.py. Tune once real glare-flagged
# uploads are observed, the same way MIN_AREA_RATIO in face_presence.py
# was retuned from real measured samples.
MAX_BRIGHT_PIXEL_RATIO = 0.20
BRIGHT_PIXEL_VALUE = 250


@dataclass
class GlareCheckResult:
    passed: bool
    bright_ratio: float


def check_glare(image_path: str) -> GlareCheckResult:
    """
    Doesn't need to be a perfect glare detector — only needs to catch the
    clearly-unreadable case (a bright reflection or blown-out
    overexposure washing out a meaningful chunk of the document) before
    it wastes a full OCR/verification pass, mirroring
    check_image_quality()'s blur check. Fails open on any read error.
    """
    try:
        gray = load_grayscale(image_path)
        if gray is None:
            return GlareCheckResult(passed=True, bright_ratio=0.0)

        total_pixels = gray.size
        if total_pixels == 0:
            return GlareCheckResult(passed=True, bright_ratio=0.0)

        bright_pixels = int((gray >= BRIGHT_PIXEL_VALUE).sum())
        ratio = bright_pixels / total_pixels
        return GlareCheckResult(passed=ratio < MAX_BRIGHT_PIXEL_RATIO, bright_ratio=round(float(ratio), 4))
    except Exception as e:
        logger.warning("check_glare failed on %s: %s", image_path, e)
        return GlareCheckResult(passed=True, bright_ratio=0.0)
