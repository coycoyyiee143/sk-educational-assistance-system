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
            det_limit_side_len=1600,       # tested 1280 (accuracy dropped, missed small text) and 1800 (no improvement on genuinely blurred/unscanned photos - resolution cap can't recover detail that isn't in the source image). Back to 1600 as the settled baseline
            det_limit_type='max',
            det_db_box_thresh=0.5,         # lowered from default 0.6 - catches faint/small text boxes that were being dropped. A/B tested vs default on reg form + ID + voter's cert - all checks still passed, ID accuracy slightly better. Keeping.
            det_db_unclip_ratio=1.8,       # raised from default 1.5 - expands detected boxes so small text isn't clipped before recognition. Adds some extra duplicate watermark-noise lines on heavily watermarked docs, but the matching logic (fuzzy match + label anchoring) already filters that noise out - no impact on actual verification results in testing.
            use_dilation=True,             # testing - thickens detected text strokes, may help on blurry/unscanned photos where strokes are thin/broken (different mechanism than resolution cap - worth trying on genuinely blurred source images specifically)
            det_model_dir=None,            # set below via ocr_version if using PaddleOCR's built-in mobile models
            rec_model_dir=None,
            cls_model_dir=None,
            ocr_version='PP-OCRv4',        # confirmed valid for installed paddleocr==2.8.1 (legacy 2.x API)
            use_gpu=False,                 # explicit - server has no GPU, avoids any accidental GPU probe overhead
            enable_mkldnn=True,            # CPU inference speedup on Intel/AMD - safe no-op if unsupported
            cpu_threads=2,                 # match the server's 2 vCPU limit - prevents oversubscription across workers
        )
    return _ocr


def preprocess_image(image_path: str, use_red_channel: bool = False) -> str:
    """
    Enhance image to improve OCR on watermark-heavy documents.
    Saves preprocessed image to a temp file and returns its path.

    use_red_channel: SVCC's registration form has a pink/magenta seal
    printed under the text - that color sits close to the white/cream
    paper's own red value, so extracting just the red channel flattens
    the watermark's contrast toward background while black text stays
    dark. Standard grayscale (BGR2GRAY) keeps more of the watermark's
    contrast since it factors in green/blue channels too, where pink
    reads darker. Scoped to SVCC reg forms only, not A/B tested yet
    against school IDs or voter's certs (which may have blue ink/stamps
    that red-channel isolation could hurt instead of help).
    """
    import tempfile, os
    img = cv2.imread(image_path)
    if img is None:
        return image_path

    if use_red_channel:
        _, _, r = cv2.split(img)
        gray = r
        clip_limit = 3.0
    else:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        clip_limit = 2.0

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)
    _, binary = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    suffix = os.path.splitext(image_path)[1] or '.jpg'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        cv2.imwrite(tmp.name, binary)
        return tmp.name


def run_ocr(image_path: str, school_name: str = None, document_type: str = None) -> list:
    ocr = get_ocr()

    results = ocr.ocr(image_path, cls=True)
    extracted = parse_results(results)

    avg_conf = get_average_confidence(extracted)
    min_conf = min((item["confidence"] for item in extracted), default=1.0)
    print(f"DEBUG: Overall avg confidence = {avg_conf}, min line confidence = {min_conf}", flush=True)

    # Two trigger conditions: overall average too low (broadly bad read),
    # OR any single line confidence very low (one blurry/faded section
    # dragging down accuracy while the rest of the doc reads fine and
    # keeps the average comfortably high - confirmed via debug logging
    # that a doc can sit at avg=0.8502 with individual lines at 61%,
    # which the average-only check let through unnoticed).
    if not extracted or avg_conf < 0.85 or min_conf < 0.65:
        print("DEBUG: Enhancement pass TRIGGERED", flush=True)

        use_red_channel = (
            (school_name or "").strip().upper() == "SVCC"
            and document_type == "registration_form"
        )

        preprocessed_path = preprocess_image(image_path, use_red_channel=use_red_channel)
        try:
            results2 = ocr.ocr(preprocessed_path, cls=True)
            extracted2 = parse_results(results2)

            avg2 = get_average_confidence(extracted2)
            min2 = min((item["confidence"] for item in extracted2), default=1.0)

            # Accept the enhanced pass if it improves whichever metric
            # triggered the retry — not just the average, since a
            # global-threshold enhancement can rescue one bad line
            # while slightly lowering others.
            improved_avg = avg_conf < 0.85 and avg2 > avg_conf
            improved_min = min_conf < 0.65 and min2 > min_conf

            if improved_avg or improved_min:
                extracted = extracted2
        finally:
            import os
            if preprocessed_path != image_path and os.path.exists(preprocessed_path):
                os.unlink(preprocessed_path)
    else:
        print("DEBUG: Enhancement pass SKIPPED", flush=True)

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