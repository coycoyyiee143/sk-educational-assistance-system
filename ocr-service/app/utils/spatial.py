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

def get_block_to_right(blocks: List[OcrBlock], target: OcrBlock, max_y_diff: float = 15) -> Optional[OcrBlock]:
    candidates = [b for b in blocks if b is not target and b.x_min > target.x_max and abs(b.y_center - target.y_center) <= max_y_diff]
    return min(candidates, key=lambda b: b.x_min) if candidates else None

def get_block_below(blocks: List[OcrBlock], target: OcrBlock, max_x_diff: float = 50) -> Optional[OcrBlock]:
    candidates = [b for b in blocks if b is not target and b.y_min > target.y_max and abs(b.x_center - target.x_center) <= max_x_diff]
    return min(candidates, key=lambda b: b.y_min) if candidates else None

def get_block_above(blocks: List[OcrBlock], target: OcrBlock, max_x_diff: float = 50) -> Optional[OcrBlock]:
    candidates = [b for b in blocks if b is not target and b.y_max < target.y_min and abs(b.x_center - target.x_center) <= max_x_diff]
    return max(candidates, key=lambda b: b.y_max) if candidates else None