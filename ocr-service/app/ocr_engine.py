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


def run_ocr(image_path: str) -> list:
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