import os
# PaddlePaddle's MKL-DNN backend (enable_mkldnn=True below) and OpenCV each
# bundle their own Intel OpenMP runtime. Loading both in one process trips
# "OMP: Error #15: Initializing libiomp5md.dll, but found libiomp5md.dll
# already initialized" - a native abort that kills the whole process
# (crashes the server mid-upload, not a catchable Python exception). Must
# be set before paddleocr/cv2 are imported.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from paddleocr import PaddleOCR
import cv2
import numpy as np
import tempfile

_ocr = None

# Every image handed to PaddleOCR is padded up to this exact square canvas
# before inference (see _pad_to_fixed_canvas). Real uploads arrive in wildly
# different resolutions/aspect ratios, and PaddlePaddle's CPU inference
# engine (oneDNN backend) caches per-input-shape state that is never freed
# between calls -- so a worker processing N differently-shaped documents
# accumulates N sets of cached state instead of reusing one. Forcing every
# input to the same fixed shape means the engine only ever sees one shape
# and reuses the same cached state, instead of leaking ~30-40MB of RSS per
# newly-seen shape (confirmed locally: fixed-shape repeats plateau in RSS,
# varying-shape repeats grow unbounded -- this is what took the production
# OCR worker from a ~380MB baseline up to ~4GB RSS and starved the server).
OCR_CANVAS_SIZE = 1600

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
            use_dilation=True,             # A/B tested against False on a real SVCC form - True gave both higher avg (0.8502 vs 0.8400) and higher min-line (0.5237 vs 0.5126) confidence. Keeping.
            det_model_dir=None,            # set below via ocr_version if using PaddleOCR's built-in mobile models
            rec_model_dir=None,
            cls_model_dir=None,
            ocr_version='PP-OCRv4',        # confirmed valid for installed paddleocr==2.8.1 (legacy 2.x API)
            use_gpu=False,                 # explicit - server has no GPU, avoids any accidental GPU probe overhead
            enable_mkldnn=True,            # CPU inference speedup on Intel/AMD - safe no-op if unsupported
            cpu_threads=int(os.getenv("OCR_CPU_THREADS", "2")),  # prod default of 2 matches the server's 2 vCPU limit (prevents oversubscription across workers) - override via OCR_CPU_THREADS in .env for local dev boxes with more cores
        )
    return _ocr


def _pad_to_fixed_canvas(image_path: str) -> str:
    """
    Downscales (never upscales) so the longer side fits OCR_CANVAS_SIZE,
    preserving aspect ratio, then pastes into the top-left corner of a
    fixed OCR_CANVAS_SIZE x OCR_CANVAS_SIZE white canvas. Every image
    PaddleOCR sees ends up exactly this shape, regardless of the source
    photo's resolution. Detected text stays in the unpadded top-left
    region, so bbox coordinates for real content are unaffected -- padding
    only adds blank space where nothing is ever detected. Downstream code
    (get_page_dimensions) derives page width/height from the max extent of
    detected blocks, not from image dimensions, so it's unaffected too.
    """
    img = cv2.imread(image_path)
    if img is None:
        return image_path

    h, w = img.shape[:2]
    scale = min(1.0, OCR_CANVAS_SIZE / max(h, w))
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    canvas = np.full((OCR_CANVAS_SIZE, OCR_CANVAS_SIZE, 3), 255, dtype=np.uint8)
    ch, cw = img.shape[:2]
    canvas[0:ch, 0:cw] = img

    suffix = os.path.splitext(image_path)[1] or '.jpg'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        cv2.imwrite(tmp.name, canvas)
        return tmp.name


def preprocess_image(image_path: str) -> str:
    """
    Enhance image to improve OCR on watermark-heavy documents.
    Saves preprocessed image to a temp file and returns its path.
    """
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

    canvas_path = _pad_to_fixed_canvas(image_path)
    try:
        results = ocr.ocr(canvas_path, cls=True)
    finally:
        if canvas_path != image_path and os.path.exists(canvas_path):
            os.unlink(canvas_path)
    extracted = parse_results(results)

    avg_conf = get_average_confidence(extracted)
    min_conf = min((item["confidence"] for item in extracted), default=1.0)

    # Two trigger conditions: overall average too low (broadly bad read),
    # OR any single line confidence very low (one blurry/faded section
    # dragging down accuracy while the rest of the doc reads fine and
    # keeps the average comfortably high - confirmed via debug logging
    # that a doc can sit at avg=0.8502 with individual lines at 61%,
    # which the average-only check let through unnoticed).
    if not extracted or avg_conf < 0.85 or min_conf < 0.65:
        preprocessed_path = preprocess_image(image_path)
        preprocessed_canvas_path = _pad_to_fixed_canvas(preprocessed_path)
        try:
            results2 = ocr.ocr(preprocessed_canvas_path, cls=True)
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
            if preprocessed_path != image_path and os.path.exists(preprocessed_path):
                os.unlink(preprocessed_path)
            if preprocessed_canvas_path != preprocessed_path and os.path.exists(preprocessed_canvas_path):
                os.unlink(preprocessed_canvas_path)

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