# tests/test_spatial_utils.py
#
# Unit tests for app.utils.spatial — pure geometric block-relationship
# helpers used by the keyword/name extraction engines.

import pytest

from app.models import OcrBlock
from app.utils.spatial import (
    get_blocks_in_region,
    get_block_to_right,
    get_block_below,
    get_block_above,
)


def block(text, x_min, y_min, x_max, y_max, conf=0.95):
    return OcrBlock(text=text, confidence=conf, x_min=x_min, y_min=y_min, x_max=x_max, y_max=y_max)


# ── get_blocks_in_region() ────────────────────────────────────────────

def test_get_blocks_in_region_header_keeps_only_top_quarter():
    top = block("Top", 0, 0, 50, 20)          # y_center=10, ratio 0.01
    bottom = block("Bottom", 0, 900, 50, 950)  # y_center=925, ratio 0.925
    blocks = [top, bottom]
    result = get_blocks_in_region(blocks, page_w=1000, page_h=1000, region="header")
    assert result == [top]


def test_get_blocks_in_region_unknown_region_returns_all_blocks():
    blocks = [block("A", 0, 0, 10, 10), block("B", 500, 500, 510, 510)]
    assert get_blocks_in_region(blocks, 1000, 1000, "nonexistent_region") == blocks


def test_get_blocks_in_region_left_column_excludes_right_side():
    left = block("Left", 0, 0, 50, 20)
    right = block("Right", 800, 0, 850, 20)
    result = get_blocks_in_region([left, right], 1000, 1000, "left_column")
    assert result == [left]


# ── get_block_to_right() ──────────────────────────────────────────────

def test_get_block_to_right_finds_nearest_same_line_block():
    label = block("Name:", 0, 0, 100, 20)
    near = block("Juan Dela Cruz", 110, 0, 300, 20)
    far = block("Far Away", 400, 0, 600, 20)
    result = get_block_to_right([label, near, far], label)
    assert result is near


def test_get_block_to_right_ignores_blocks_on_different_line():
    label = block("Name:", 0, 0, 100, 20)
    off_line = block("Unrelated", 110, 500, 300, 520)
    result = get_block_to_right([label, off_line], label)
    assert result is None


def test_get_block_to_right_ignores_trivial_single_char_blocks():
    label = block("Name:", 0, 0, 100, 20)
    colon_stray = block(":", 105, 0, 110, 20)
    value = block("Juan Dela Cruz", 115, 0, 300, 20)
    result = get_block_to_right([label, colon_stray, value], label)
    assert result is value


def test_get_block_to_right_no_candidates_returns_none():
    label = block("Name:", 0, 0, 100, 20)
    result = get_block_to_right([label], label)
    assert result is None


def test_get_block_to_right_respects_explicit_max_y_diff_override():
    label = block("Name:", 0, 0, 100, 20)
    slightly_off = block("Value", 110, 20, 300, 40)  # y_center=30, diff from label's 10 = 20
    # default tolerance (target.height*0.8=16) would exclude this
    assert get_block_to_right([label, slightly_off], label) is None
    # explicit generous override includes it
    assert get_block_to_right([label, slightly_off], label, max_y_diff=25) is slightly_off


# ── get_block_below() ──────────────────────────────────────────────────

def test_get_block_below_finds_nearest_block_beneath():
    label = block("School Year:", 0, 0, 200, 20)
    near = block("2025-2026", 0, 25, 200, 45)
    far = block("Far", 0, 500, 200, 520)
    result = get_block_below([label, near, far], label)
    assert result is near


def test_get_block_below_ignores_horizontally_misaligned_block():
    label = block("School Year:", 0, 0, 200, 20)
    off_side = block("Unrelated", 900, 25, 1000, 45)
    result = get_block_below([label, off_side], label)
    assert result is None


def test_get_block_below_ignores_trivial_blocks():
    label = block("School Year:", 0, 0, 200, 20)
    stray_dot = block(".", 0, 22, 5, 26)
    value = block("2025-2026", 0, 40, 200, 60)
    result = get_block_below([label, stray_dot, value], label)
    assert result is value


# ── get_block_above() ──────────────────────────────────────────────────

def test_get_block_above_finds_nearest_block_overhead():
    value = block("2025-2026", 0, 40, 200, 60)
    near = block("School Year:", 0, 0, 200, 20)
    far = block("Far Header", 0, -500, 200, -480)
    result = get_block_above([value, near, far], value)
    assert result is near


def test_get_block_above_no_candidates_returns_none():
    value = block("2025-2026", 0, 40, 200, 60)
    assert get_block_above([value], value) is None


def test_get_block_above_ignores_horizontally_misaligned_block():
    value = block("2025-2026", 0, 40, 200, 60)
    off_side = block("Unrelated", 900, 0, 1000, 20)
    assert get_block_above([value, off_side], value) is None
