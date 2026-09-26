# ocr-service/scripts/ab_test_detection_params.py
"""
A/B test PaddleOCR's text-DETECTION parameters (det_db_box_thresh,
det_db_unclip_ratio, use_dilation) against a folder of real scanned
documents.

Why this exists: these three settings were tuned in ocr_engine.py to fix
small/faint text being dropped or clipped, but the same permissiveness
that fixes that can also cause the DETECTOR to merge two visually
separate lines into one (confirmed on a real UPLB Registration Form,
where the school-name line and the entire consent paragraph beneath it
were read as a single OCR block instead of two). This script measures
the tradeoff directly instead of guessing at it: for each candidate
config, it reports average/min confidence (what the current settings
were originally tuned to protect) AND a simple line-merge proxy (the
longest single detected line's character length -- a genuinely merged
line is dramatically longer than any real single printed line, so a
big jump here across configs is a real signal, not noise).

USAGE (run from ocr-service/, with the venv active):
    python scripts/ab_test_detection_params.py
    python scripts/ab_test_detection_params.py --glob "C:/Users/DELL/Documents/Data testing/UP-LB/RF/*.jpg"
    python scripts/ab_test_detection_params.py --glob "...*.jpg" --limit 5

Each config change requires a brand-new PaddleOCR instance (these are
constructor params, not per-call args), so this reloads the model once
per config -- expect this to take a few minutes for the full default
set of configs x images, not something to run on every commit.
"""
import argparse
import glob
import os
import statistics
import subprocess
import sys
import time

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from paddleocr import PaddleOCR  # noqa: E402

# Mirrors the DATA_ROOT convention in OcrTestSeeder.php so this
# script can be pointed at the same real-document corpus by default.
DEFAULT_GLOB = "C:/Users/DELL/Documents/Data testing/UP-LB/RF/*.jpg"

# "current" is exactly what's live in app/ocr_engine.py today.
# "baseline" is PaddleOCR's own un-tuned defaults, for reference.
# "middle_ground" backs off unclip_ratio/dilation slightly while keeping
# the lowered box_thresh, to see if merging specifically comes from the
# expansion/dilation side rather than the detection threshold itself.
CONFIGS = {
    "baseline_defaults": dict(det_db_box_thresh=0.6, det_db_unclip_ratio=1.5, use_dilation=False),
    "current_production": dict(det_db_box_thresh=0.5, det_db_unclip_ratio=1.8, use_dilation=True),
    "middle_ground": dict(det_db_box_thresh=0.5, det_db_unclip_ratio=1.6, use_dilation=True),
    "no_dilation_only": dict(det_db_box_thresh=0.5, det_db_unclip_ratio=1.8, use_dilation=False),
}


def build_ocr(params: dict) -> PaddleOCR:
    return PaddleOCR(
        lang="en",
        use_angle_cls=True,
        show_log=False,
        det_limit_side_len=1600,
        det_limit_type="max",
        det_model_dir=None,
        rec_model_dir=None,
        cls_model_dir=None,
        ocr_version="PP-OCRv4",
        use_gpu=False,
        enable_mkldnn=False,
        cpu_threads=int(os.getenv("OCR_CPU_THREADS", "2")),
        **params,
    )


def run_config(name: str, params: dict, image_paths: list[str]) -> None:
    print(f"\n=== {name}  {params} ===")
    ocr = build_ocr(params)

    all_confidences = []
    line_counts = []
    longest_lines = []  # (length, image, text) -- top few printed at the end

    for path in image_paths:
        start = time.time()
        try:
            result = ocr.ocr(path, cls=True)
        except Exception as e:
            print(f"  [ERROR] {os.path.basename(path)}: {e}")
            continue
        elapsed = time.time() - start

        lines = result[0] if result and result[0] else []
        line_counts.append(len(lines))

        for bbox, (text, conf) in lines:
            all_confidences.append(conf)
            longest_lines.append((len(text), os.path.basename(path), text))

        print(f"  {os.path.basename(path):20s} lines={len(lines):3d}  {elapsed:.1f}s")

    if not all_confidences:
        print("  No lines detected across any image — skipping stats.")
        return

    longest_lines.sort(reverse=True)

    print(f"\n  avg confidence : {statistics.mean(all_confidences):.4f}")
    print(f"  min confidence : {min(all_confidences):.4f}")
    print(f"  avg lines/doc  : {statistics.mean(line_counts):.1f}")
    print(f"  longest single lines (possible merges):")
    for length, image, text in longest_lines[:5]:
        preview = text[:80] + ("…" if len(text) > 80 else "")
        print(f"    [{length:4d} chars] {image}: {preview}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--glob", default=DEFAULT_GLOB, help="Glob pattern for images to test against.")
    parser.add_argument("--limit", type=int, default=None, help="Only test the first N matched images (default: all).")
    parser.add_argument("--configs", nargs="*", default=list(CONFIGS.keys()), help="Subset of config names to run.")
    args = parser.parse_args()

    image_paths = sorted(glob.glob(args.glob))
    if args.limit:
        image_paths = image_paths[: args.limit]

    if not image_paths:
        print(f"No images matched: {args.glob}")
        return

    unknown = [n for n in args.configs if n not in CONFIGS]
    if unknown:
        print(f"Unknown config(s) {unknown} — must be one of: {list(CONFIGS.keys())}")
        return

    print(f"Testing {len(image_paths)} image(s) against {len(args.configs)} config(s).")

    if len(args.configs) == 1:
        # Only one PaddleOCR instance ever gets constructed in THIS
        # process, so no reinitialization risk -- run directly.
        run_config(args.configs[0], CONFIGS[args.configs[0]], image_paths)
        return

    # Re-initializing PaddleOCR multiple times in one process (one per
    # config) has been observed to segfault -- matches ocr_engine.py's
    # own documented MKL-DNN/OpenMP instability under repeated
    # inference-engine setup in a single process. Isolate each config
    # in its OWN subprocess instead, so a crash in one config's run
    # can't take down the others or leave you guessing which config
    # caused it.
    for name in args.configs:
        print(f"\n--- launching isolated subprocess for '{name}' ---")
        result = subprocess.run(
            [sys.executable, __file__, "--glob", args.glob, "--configs", name]
            + (["--limit", str(args.limit)] if args.limit else []),
        )
        if result.returncode != 0:
            print(f"  [WARNING] subprocess for '{name}' exited with code {result.returncode} (possible crash).")


if __name__ == "__main__":
    main()
