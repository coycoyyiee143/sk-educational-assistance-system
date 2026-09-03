from paddleocr import PaddleOCR
import cv2
import numpy as np

_ocr = None

def get_ocr():
    global _ocr
    if _ocr is None:
        _ocr = PaddleOCR(
            lang='en',
            use_angle_cls=True,
            show_log=False,
            det_limit_side_len=1600,
            det_limit_type='max',
        )
    return _ocr


def preprocess_image(image_path: str) -> str:
    """
    Enhance image to improve OCR on watermark-heavy documents.
    Saves preprocessed image to a temp file and returns its path.
    """
    import tempfile, os
    img = cv2.imread(image_path)
    if img is None:
        return image_path

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)
    _, binary = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    suffix = os.path.splitext(image_path)[1] or '.jpg'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        cv2.imwrite(tmp.name, binary)
        return tmp.name


def _ocr_bottom_strip(image_path: str, strip_fraction: float = 0.15) -> list:
    """
    Crops just the bottom slice of the page (default: bottom 15%) and
    re-runs OCR on that crop alone, at its native resolution. A small
    crop needs no internal downscaling even with default PaddleOCR
    settings, so small text near the page edge (e.g. a HASH line) gets
    a real shot at being detected instead of competing for detail
    budget against the whole page. Y-coordinates of the returned blocks
    are offset back into the ORIGINAL image's coordinate space, so they
    merge cleanly with the main OCR pass's blocks.
    """
    import tempfile, os
    img = cv2.imread(image_path)
    if img is None:
        return []

    h, w = img.shape[:2]
    y_offset = int(h * (1 - strip_fraction))
    crop = img[y_offset:h, 0:w]

    suffix = os.path.splitext(image_path)[1] or '.jpg'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        cv2.imwrite(tmp.name, crop)
        crop_path = tmp.name

    try:
        ocr = get_ocr()
        results = ocr.ocr(crop_path, cls=True)
        blocks = parse_results(results)
        for b in blocks:
            # Shift bbox y-coordinates back to the original image's space
            b["bbox"] = [[pt[0], pt[1] + y_offset] for pt in b["bbox"]]
        return blocks
    finally:
        if os.path.exists(crop_path):
            os.unlink(crop_path)


def run_ocr(image_path: str, boost_bottom_strip: bool = False) -> list:
    ocr = get_ocr()

    results = ocr.ocr(image_path, cls=True)
    extracted = parse_results(results)

    if not extracted or get_average_confidence(extracted) < 0.75:
        preprocessed_path = preprocess_image(image_path)
        try:
            results2 = ocr.ocr(preprocessed_path, cls=True)
            extracted2 = parse_results(results2)
            if get_average_confidence(extracted2) > get_average_confidence(extracted):
                extracted = extracted2
        finally:
            import os
            if preprocessed_path != image_path and os.path.exists(preprocessed_path):
                os.unlink(preprocessed_path)

    # Voter's Certification-specific: the HASH marker sits at a known,
    # fixed position (bottom of page), so a second targeted pass on just
    # that region catches text the main pass's downscale/detail budget
    # might miss — merged in as extra blocks, not a replacement.
    if boost_bottom_strip:
        bottom_blocks = _ocr_bottom_strip(image_path)
        # Avoid literal duplicate lines already captured by the main pass
        existing_texts = {b["text"].strip().lower() for b in extracted}
        for b in bottom_blocks:
            if b["text"].strip().lower() not in existing_texts:
                extracted.append(b)

    return extracted


def parse_results(results) -> list:
    extracted = []
    if not results or not results[0]:
        return extracted
    for line in results[0]:
        bbox = line[0]
        text = line[1][0]
        confidence = line[1][1]
        if not text.strip():
            continue
        extracted.append({
            "text": text.strip(),
            "confidence": round(float(confidence), 4),
            "bbox": bbox
        })
    return extracted


def get_average_confidence(ocr_result: list) -> float:
    if not ocr_result:
        return 0.0
    return round(
        sum(item["confidence"] for item in ocr_result) / len(ocr_result), 4
    )