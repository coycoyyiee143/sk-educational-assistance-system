# app/utils/image_loading.py
import cv2
import logging

logger = logging.getLogger(__name__)


def load_grayscale(image_path: str):
    """
    Returns a grayscale numpy array for the uploaded image. Returns None
    if the file can't be read.

    Shared by every upload_checks helper that inspects raw pixels (blur,
    glare, skew, ID-photo presence) so they all load the file the same
    way instead of each reimplementing cv2.imread() + conversion
    separately. PDF uploads are rejected at the Laravel layer
    (DocumentController's mimes validation is jpg/jpeg/png only) and by
    the frontend before that, so no PDF-rendering path is needed here.
    """
    img = cv2.imread(image_path)
    if img is None:
        return None
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
