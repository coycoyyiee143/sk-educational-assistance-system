# app/upload_checks/perceptual_hash.py
import logging
from typing import Optional
import cv2
from app.utils.image_loading import load_grayscale

logger = logging.getLogger(__name__)


def compute_phash(image_path: str) -> Optional[str]:
    """
    64-bit difference hash (dHash) — cheap, no extra dependency (reuses
    the same OpenCV/PyMuPDF stack already loaded for every other pixel
    check), and tolerant of the resave/recompress/resize noise a normal
    upload pipeline introduces, unlike a cryptographic hash which would
    only catch a byte-for-byte identical file.

    Returned as a hex string for the caller (Laravel, via ProcessOcrDocument)
    to persist and compare across OTHER applications' documents of the
    same type — catches the same physical ID/cert photo being reused
    across two different applications (e.g. a shared or borrowed ID),
    not just a byte-identical reupload of the same file. Comparison is
    Hamming distance (XOR + popcount), not exact match, since a
    re-photographed or re-scanned copy of the same physical document
    won't hash byte-identical.

    Returns None on any read/processing error — duplicate detection is a
    secondary signal, not a gate, so this fails open rather than risking
    a false block on a legitimate upload.
    """
    try:
        gray = load_grayscale(image_path)
        if gray is None:
            return None

        resized = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
        diff = resized[:, 1:] > resized[:, :-1]

        value = 0
        for bit in diff.flatten():
            value = (value << 1) | int(bit)
        return format(value, '016x')
    except Exception as e:
        logger.warning("compute_phash failed on %s: %s", image_path, e)
        return None


def hamming_distance(hash_a: str, hash_b: str) -> int:
    """Bit difference between two hex dHash strings — for reference/testing;
    Laravel does its own comparison since it owns the cross-document query."""
    return bin(int(hash_a, 16) ^ int(hash_b, 16)).count("1")
