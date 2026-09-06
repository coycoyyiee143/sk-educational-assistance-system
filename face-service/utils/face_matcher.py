"""
Core face-matching logic. Kept separate from app.py so the comparison
logic can be tested/swapped independently of the Flask wiring.
"""
import face_recognition
import numpy as np
from PIL import Image


# Lower = stricter match. 0.6 is face_recognition's own recommended default.
DEFAULT_TOLERANCE = 0.5

# Most valid IDs (national ID, school ID, driver's license, etc.) are
# card-shaped: noticeably wider/taller on one side than the other, but not
# extremely so. This rejects obviously-wrong uploads (square selfies,
# wide landscape photos, screenshots of documents, memes, etc.) before we
# even bother running face detection on them.
ID_MIN_ASPECT_RATIO = 1.2   # e.g. a nearly-square image gets rejected
ID_MAX_ASPECT_RATIO = 2.4   # e.g. a wide banner/landscape photo gets rejected


def looks_like_id_shape(image_path: str) -> bool:
    """
    Cheap sanity check that the uploaded image is at least card-shaped,
    before we spend time running face detection on it.
    """
    with Image.open(image_path) as img:
        width, height = img.size

    long_side = max(width, height)
    short_side = min(width, height)
    if short_side == 0:
        return False

    ratio = long_side / short_side
    return ID_MIN_ASPECT_RATIO <= ratio <= ID_MAX_ASPECT_RATIO


def get_face_encoding(image_path: str):
    """
    Loads an image and returns the 128-d face encoding of the FIRST
    detected face, or None if no face was found.
    """
    image = face_recognition.load_image_file(image_path)
    encodings = face_recognition.face_encodings(image)

    if len(encodings) == 0:
        return None

    # If somehow multiple faces are in frame (e.g. ID photo with a
    # second person in the background), just use the first/largest one.
    return encodings[0]


def compare_encodings(encoding_a: np.ndarray, encoding_b: np.ndarray, tolerance: float = DEFAULT_TOLERANCE):
    """
    Compares two face encodings.
    Returns (match: bool, score: float) where score is a 0-100 "similarity"
    percentage that's easier for the Laravel side / UI to display than a
    raw distance value.
    """
    distance = np.linalg.norm(encoding_a - encoding_b)
    match = distance <= tolerance

    # Convert distance (0 = identical, ~1+ = very different) into a
    # friendlier 0-100 score. Clamped so it never goes negative.
    score = max(0.0, (1 - distance) * 100)

    return bool(match), round(float(score), 2)


def encoding_to_list(encoding: np.ndarray):
    """Convert numpy array to a plain list so it can be JSON-serialized
    and stored in Laravel's face_embedding JSON column."""
    return encoding.tolist()


def encoding_from_list(embedding_list):
    """Reverse of encoding_to_list — used when comparing a fresh photo
    against a previously stored embedding."""
    return np.array(embedding_list)