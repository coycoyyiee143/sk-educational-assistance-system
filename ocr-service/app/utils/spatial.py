# app/utils/spatial.py
from typing import List, Optional
from app.models import OcrBlock

def get_blocks_in_region(blocks: List[OcrBlock], page_w: float, page_h: float, region: str) -> List[OcrBlock]:
    regions = {
        "header":        (0.0, 0.0,  1.0,  0.25),
        "top_half":      (0.0, 0.0,  1.0,  0.50),
        "left_column":  (0.0, 0.0,  0.5,  1.0),
        "right_column": (0.5, 0.0,  1.0,  1.0),
        "center":       (0.2, 0.0,  0.8,  0.40),
    }
    if region not in regions:
        return blocks
    x0_r, y0_r, x1_r, y1_r = regions[region]
    return [b for b in blocks if x0_r * page_w <= b.x_center <= x1_r * page_w and y0_r * page_h <= b.y_center <= y1_r * page_h]

def get_block_to_right(blocks: List[OcrBlock], target: OcrBlock, max_y_diff: Optional[float] = None) -> Optional[OcrBlock]:
    """
    max_y_diff defaults to a fraction of the target's OWN text height
    rather than a fixed pixel count. A fixed pixel tolerance (the old
    default was 15) only makes sense at one specific image resolution —
    the same physical line spacing can be ~15px on a low-res scan but
    ~50-70px on a modern phone photo, since uploads aren't resized to a
    canonical size before this runs. Scaling by the block's own height
    keeps "same line" meaning the same thing regardless of upload
    resolution. An explicit max_y_diff can still be passed to override.
    """
    if max_y_diff is None:
        max_y_diff = max(target.height * 0.8, 5)
    candidates = [b for b in blocks if b is not target and b.x_min > target.x_max and abs(b.y_center - target.y_center) <= max_y_diff]
    return min(candidates, key=lambda b: b.x_min) if candidates else None

def get_block_below(blocks: List[OcrBlock], target: OcrBlock, max_x_diff: Optional[float] = None) -> Optional[OcrBlock]:
    """See get_block_to_right — same resolution-independence reasoning,
    scaled by the target's height (used as a proxy for the document's
    general text scale) rather than the old fixed 50px."""
    if max_x_diff is None:
        max_x_diff = max(target.height * 3.0, 15)
    candidates = [b for b in blocks if b is not target and b.y_min > target.y_max and abs(b.x_center - target.x_center) <= max_x_diff]
    return min(candidates, key=lambda b: b.y_min) if candidates else None

def get_block_above(blocks: List[OcrBlock], target: OcrBlock, max_x_diff: Optional[float] = None) -> Optional[OcrBlock]:
    """See get_block_to_right — same reasoning."""
    if max_x_diff is None:
        max_x_diff = max(target.height * 3.0, 15)
    candidates = [b for b in blocks if b is not target and b.y_max < target.y_min and abs(b.x_center - target.x_center) <= max_x_diff]
    return max(candidates, key=lambda b: b.y_max) if candidates else None