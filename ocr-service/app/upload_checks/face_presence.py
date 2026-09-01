# app/upload_checks/face_presence.py
import cv2
from dataclasses import dataclass

_FACE_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
_face_cascade = None


def _get_cascade():
    global _face_cascade
    if _face_cascade is None:
        _face_cascade = cv2.CascadeClassifier(_FACE_CASCADE_PATH)
    return _face_cascade


@dataclass
class FacePresenceResult:
    has_large_centered_face: bool
    face_count: int
    largest_face_area_ratio: float


# School ID cardholder photos are large and roughly centered. A Voter's
# Certification's biometric section (if any photo-like graphic exists at
# all) is small and positioned to the side, not centered. Registration
# Forms have no photo at all.
MIN_AREA_RATIO = 0.03
CENTER_TOLERANCE = 0.25


def detect_id_photo(image_path: str) -> FacePresenceResult:
    """
    Uses OpenCV's bundled Haar Cascade — no extra model download, no
    dependency on the heavier face_recognition/dlib stack used by the
    separate face-service microservice. Operates on raw pixels, not OCR
    text, so it's unaffected by OCR extraction issues.
    """
    img = cv2.imread(image_path)
    if img is None:
        return FacePresenceResult(has_large_centered_face=False, face_count=0, largest_face_area_ratio=0.0)

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = _get_cascade().detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))

    if len(faces) == 0:
        return FacePresenceResult(has_large_centered_face=False, face_count=0, largest_face_area_ratio=0.0)

    fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
    area_ratio = (fw * fh) / (w * h)
    face_center_x = fx + fw / 2
    page_center_x = w / 2
    is_centered = abs(face_center_x - page_center_x) / w <= CENTER_TOLERANCE

    return FacePresenceResult(
        has_large_centered_face=(area_ratio >= MIN_AREA_RATIO and is_centered),
        face_count=len(faces),
        largest_face_area_ratio=round(area_ratio, 4),
    )