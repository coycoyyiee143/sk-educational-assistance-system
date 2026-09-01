import logging
from dataclasses import dataclass, field
from typing import List
from PIL import Image, ImageChops
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class ElaResult:
    passed: bool
    flags: List[str] = field(default_factory=list)
    max_difference: int = 0
    mean_difference: float = 0.0
    score: float = 1.0


def describe_ela_score(score: float) -> str:
    """Converts a numeric ELA score into a verifier-friendly label."""
    if score >= 0.8:
        return "No Significant Edit Artifacts Detected"
    if score >= 0.6:
        return "Minor Compression Irregularities Detected"
    if score >= 0.4:
        return "Moderate Edit Artifacts Detected"
    return "Significant Edit Artifacts Detected"


def compute_ela(image_path: str, quality: int = 90,
                 max_diff_threshold: int = 60,
                 mean_diff_threshold: float = 8.0) -> ElaResult:
    """
    Error Level Analysis — resaves the image at a fixed JPEG quality and
    compares it against the original. Unedited regions show a fairly
    uniform, low difference from recompression alone. Spliced or edited
    regions (pasted-in photo, altered text, replaced seal) tend to show
    a noticeably higher difference, since that region has a different
    compression history than the rest of the image.

    This is a pre-screening signal only — it flags images for manual
    verifier review, it does not confirm forgery on its own. It also
    cannot reliably catch a document that was fabricated from scratch
    with no splicing (no edited-vs-original boundary to detect), or
    AI-generated content — this is a known, documented limitation.
    """
    flags: List[str] = []
    try:
        original = Image.open(image_path).convert('RGB')
    except Exception as e:
        # Fail open deliberately (don't block a legit applicant over a
        # code/format error), but log it — otherwise this check can
        # silently no-op on every upload and nobody would ever notice.
        logger.warning("ELA skipped — could not open image %s: %s", image_path, e)
        return ElaResult(passed=True, flags=[], score=1.0)

    resaved_path = image_path + "_ela_tmp.jpg"
    try:
        original.save(resaved_path, 'JPEG', quality=quality)
        resaved = Image.open(resaved_path)

        diff = ImageChops.difference(original, resaved)
        diff_array = np.array(diff)

        max_diff = int(np.max(diff_array))
        mean_diff = float(np.mean(diff_array))

        if max_diff > max_diff_threshold:
            flags.append(f"High localized compression difference detected (max: {max_diff})")
        if mean_diff > mean_diff_threshold:
            flags.append(f"Elevated overall compression difference (mean: {mean_diff:.2f})")

        score = max(0.0, 1.0 - (0.3 * len(flags)))
        return ElaResult(
            passed=len(flags) == 0,
            flags=flags,
            max_difference=max_diff,
            mean_difference=mean_diff,
            score=score,
        )
    finally:
        import os
        if os.path.exists(resaved_path):
            os.remove(resaved_path)