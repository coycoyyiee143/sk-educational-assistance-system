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
            use_dilation=True,             # A/B tested against False on a real SVCC form - True gave both higher avg (0.8502 vs 0.8400) and higher min-line (0.5237 vs 0.5126) confidence. Keeping.
            det_model_dir=None,            # set below via ocr_version if using PaddleOCR's built-in mobile models
            rec_model_dir=None,
            cls_model_dir=None,
            ocr_version='PP-OCRv4',        # confirmed valid for installed paddleocr==2.8.1 (legacy 2.x API)
            use_gpu=False,                 # explicit - server has no GPU, avoids any accidental GPU probe overhead
            enable_mkldnn=False,           # was True (CPU inference speedup) - disabled: MKL-DNN's bundled OpenMP
                                            # runtime conflicts with OpenCV's own (see KMP_DUPLICATE_LIB_OK note
                                            # above), and KMP_DUPLICATE_LIB_OK=TRUE only silences the abort
                                            # message rather than fixing the thread-safety issue - confirmed
                                            # causing real 0xc0000005 access-violation crashes (Windows Event
                                            # Viewer Application log) under sustained back-to-back OCR load,
                                            # not just the rare one-off. Revisit if CPU inference speed becomes
                                            # a real bottleneck and a safer MKL-DNN/OpenMP coexistence is found.
            cpu_threads=int(os.getenv("OCR_CPU_THREADS", "2")),  # prod default of 2 matches the server's 2 vCPU limit (prevents oversubscription across workers) - override via OCR_CPU_THREADS in .env for local dev boxes with more cores
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
        try:
            results2 = ocr.ocr(preprocessed_path, cls=True)
            extracted2 = parse_results(results2)

            avg2 = get_average_confidence(extracted2)
            min2 = min((item["confidence"] for item in extracted2), default=1.0)

            # Accept the enhanced pass if it improves whichever metric
            # triggered the retry — not just the average, since a
            # global-threshold enhancement can rescue one bad line
            # while slightly lowering others.
            #
            # REGRESSION_TOLERANCE guards against the swap being a wholesale
            # WORSE trade dressed up as an improvement -- confirmed on a
            # real UPLB Voter's Certificate where the enhanced pass barely
            # nudged min_conf up (0.5217 -> 0.5325, a 0.011 gain) while
            # avg_conf collapsed from 0.9095 to 0.7669 (a 0.143 drop),
            # because CLAHE+sharpen+Otsu binarization garbled several
            # previously-clean lines -- including turning a 95%-confidence
            # "VILLANUEVA,JHON VINCENT" into an 81%-confidence
            # "VLANEVA JHONVINGENT" that then failed identity_match's fuzzy
            # threshold entirely. Without this guard, extracted swaps to
            # extracted2 WHOLESALE on that trade, silently trashing every
            # other line's already-good read to chase a marginal gain on
            # whichever single line was worst. Requiring the OTHER metric
            # not regress by more than a small tolerance keeps the rescue
            # this retry exists for (a doc where enhancement is a genuine
            # net win) while blocking one where it plainly isn't.
            REGRESSION_TOLERANCE = 0.05

            # MIN_TRIGGER_TOLERANCE is deliberately much tighter than
            # REGRESSION_TOLERANCE above -- confirmed on a real PUP School
            # ID where avg_conf was already 0.9108 (comfortably above the
            # 0.85 "reads fine overall" bar) and only a single decorative
            # slogan line ("The Country's 1st Polytechnic U", 0.595)
            # tripped the min_conf<0.65 retry. The enhanced pass nudged
            # that one line's confidence up but, in the process, garbled
            # the institution header from a clean "POLYTECHNIC" /
            # "UNIVERSITY" / "PHILIPPINES" (0.94-0.98 each, a passing
            # institution_match) into "P OLYTECHNIC" / "UNIvERSIty" /
            # "Pattirrines" (a failing one) -- yet avg_conf only dropped to
            # 0.8937, a 0.017 drop that sailed under the 0.05 tolerance
            # and let the swap through anyway. When the document already
            # reads well overall, the min-triggered retry is almost always
            # chasing a low-value line (decorative text, a watermark) --
            # there's little to gain and, as here, real already-good
            # content to lose, so barely any regression should be
            # tolerated before assuming the swap did collateral damage
            # elsewhere.
            MIN_TRIGGER_TOLERANCE = 0.01

            improved_avg = avg_conf < 0.85 and avg2 > avg_conf and min2 >= min_conf - REGRESSION_TOLERANCE
            improved_min = min_conf < 0.65 and min2 > min_conf and avg2 >= avg_conf - MIN_TRIGGER_TOLERANCE

            if improved_avg or improved_min:
                extracted = extracted2
        finally:
            import os
            if preprocessed_path != image_path and os.path.exists(preprocessed_path):
                os.unlink(preprocessed_path)

    return extracted


# UPLB's registration form header ("UP Form 5. University of the
# Philippines Los Baños Certificate of Registration") is printed
# entirely in solid red, unlike every other (black) line on the page.
# Confirmed on a real sample: PaddleOCR's text DETECTOR (not just
# recognition) misses that line completely on the raw color image --
# red apparently converts to a low-contrast mid-gray during its
# internal processing -- while every other line reads at 98-100%
# confidence. Since nothing that WAS detected reads unconfidently, the
# retry above never triggers; the line is just silently absent, not
# low-confidence. This header is always present on a genuine UPLB
# document, so it's worth a specific, cheap check here rather than a
# blanket second OCR pass for every document from every school.
_UPLB_SCHOOL_NAMES = {"UNIVERSITY OF THE PHILIPPINES LOS BANOS", "UPLB"}


def _has_uplb_header(extracted: list) -> bool:
    # Checking for "BAÑOS" specifically, NOT "PHILIPPINES" -- the reg
    # form's student pledge paragraph text also genuinely contains
    # "University of the Philippines System", so a "PHILIPPINES" check
    # alone is satisfied by that unrelated block and never actually
    # detects whether the real header line was found (confirmed: this
    # was the original, broken version of this check). "Baños" only
    # ever appears in the header/campus name, nowhere else on the page.
    from app.normalization.text_utils import strip_diacritics
    return any('BANOS' in strip_diacritics(item['text']).upper() for item in extracted)


def ensure_uplb_reg_form_header(image_path: str, extracted: list, declared_school: str) -> list:
    from app.normalization.text_utils import strip_diacritics

    if strip_diacritics(declared_school or "").strip().upper() not in _UPLB_SCHOOL_NAMES:
        return extracted
    if _has_uplb_header(extracted):
        return extracted

    ocr = get_ocr()
    preprocessed_path = preprocess_image(image_path)
    try:
        results2 = ocr.ocr(preprocessed_path, cls=True)
        extracted2 = parse_results(results2)
    finally:
        import os
        if preprocessed_path != image_path and os.path.exists(preprocessed_path):
            os.unlink(preprocessed_path)

    # Merge in just the header line(s) recovered from the enhanced pass
    # rather than swapping the whole result -- the original pass's
    # (already-good) reads of everything else stay untouched.
    header_lines = [item for item in extracted2 if 'BANOS' in strip_diacritics(item['text']).upper()]
    return extracted + header_lines

    return extracted


# SVCC's Registration Form prints its "Name:" line, and separately its
# "School Year:" line, directly under a diagonal watermark ribbon that
# runs right through the middle of the page. Confirmed on two different
# real SVCC samples that PaddleOCR's text DETECTOR (not just recognition)
# drops whichever one of those lines happens to sit closest to the
# watermark's thickest band entirely on the raw color image -- RF-046
# lost its Name line, RF-056 lost its School Year line instead, while
# the Student# line above and Course line below both read at 95%+ either
# time, and nothing else on the page is affected. So run_ocr()'s
# confidence-based retry above never triggers: a fully MISSING line adds
# nothing to avg/min confidence, it just isn't in the output to drag
# either stat down -- and RF-056's case is worse than a bare miss: with
# the real "School Year: 2022" line gone, school-year extraction fell
# back to matching the unrelated "Print date: 06-16-2026" line instead,
# reporting a confidently wrong detected year (2026) rather than the
# document's actual (also wrong, but different) declared year (2022).
#
# Two DIFFERENT root causes turned out to need two different rescues:
#  - RF-046's Name line: a pure contrast problem (watermark ink vs. text
#    ink at the SAME resolution) -- the existing grayscale+CLAHE+
#    sharpen+Otsu preprocess_image() pass recovers it fine (confirmed:
#    0.836 confidence vs. zero detection on the raw pass).
#  - RF-056's School Year line: a RESOLUTION problem instead -- PaddleOCR
#    downscales the whole page to det_limit_side_len=1600 before
#    detecting text, and at that scale this line's small font falls
#    below the detector's minimum. preprocess_image() doesn't change the
#    image's size, so it does nothing for this case (confirmed: still
#    missing after that pass too). Cropping to just the header region
#    (top 25% of the page, same definition get_blocks_in_region() uses)
#    and re-running OCR on that crop alone needs no downscaling to fit
#    the same size budget, which recovers the line fine (confirmed:
#    0.971 confidence). The crop starts at (0, 0), so its block
#    coordinates already line up with the full page -- no offset math
#    needed when merging a recovered line back in.
#
# Tries the cheaper whole-page preprocess first, then the header-crop
# pass only for whichever label(s) are still missing after that -- one
# retry sequence covers both known failure modes and whichever of the
# two labels (or both) is affected, rather than a separate retry per
# field or per cause.
_SVCC_SCHOOL_NAMES = {"ST. VINCENT COLLEGE OF CABUYAO", "ST VINCENT COLLEGE OF CABUYAO", "SVCC"}
_SVCC_CRITICAL_LABELS = ["name", "school_year"]
_SVCC_HEADER_CROP_FRACTION = 0.25  # matches get_blocks_in_region()'s "header" region


def _missing_labels(extracted: list, labels: list) -> list:
    from app.extraction.blocks import parse_ocr_blocks
    from app.extraction.keyword_engine import find_label_block
    blocks = parse_ocr_blocks(extracted)
    return [label for label in labels if find_label_block(blocks, label) is None]


def _ocr_header_crop(image_path: str, ocr) -> list:
    import cv2
    import tempfile
    import os

    img = cv2.imread(image_path)
    if img is None:
        return []
    h, w = img.shape[:2]
    crop = img[0:int(h * _SVCC_HEADER_CROP_FRACTION), 0:w]

    suffix = os.path.splitext(image_path)[1] or '.jpg'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        cv2.imwrite(tmp.name, crop)
        crop_path = tmp.name
    try:
        results = ocr.ocr(crop_path, cls=True)
        return parse_results(results)
    finally:
        if os.path.exists(crop_path):
            os.unlink(crop_path)


def ensure_svcc_reg_form_labels(image_path: str, extracted: list, declared_school: str) -> list:
    from app.normalization.text_utils import strip_diacritics, clean_text
    from app.extraction.blocks import parse_ocr_blocks
    from app.extraction.keyword_engine import find_label_block

    if strip_diacritics(declared_school or "").strip().upper() not in _SVCC_SCHOOL_NAMES:
        return extracted

    missing = _missing_labels(extracted, _SVCC_CRITICAL_LABELS)
    if not missing:
        return extracted

    ocr = get_ocr()

    def recover_from(extracted_candidate: list) -> list:
        blocks_candidate = parse_ocr_blocks(extracted_candidate)
        recovered_texts = []
        for label in missing:
            label_block = find_label_block(blocks_candidate, label)
            if label_block is not None:
                recovered_texts.append(label_block.text)
        return [
            item for item in extracted_candidate
            if clean_text(item.get("text", "")) in recovered_texts
        ]

    preprocessed_path = preprocess_image(image_path)
    try:
        results2 = ocr.ocr(preprocessed_path, cls=True)
        extracted2 = parse_results(results2)
    finally:
        import os
        if preprocessed_path != image_path and os.path.exists(preprocessed_path):
            os.unlink(preprocessed_path)

    recovered_items = recover_from(extracted2)

    still_missing = _missing_labels(extracted + recovered_items, _SVCC_CRITICAL_LABELS)
    if still_missing:
        missing = still_missing
        extracted3 = _ocr_header_crop(image_path, ocr)
        recovered_items += recover_from(extracted3)

    return extracted + recovered_items


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