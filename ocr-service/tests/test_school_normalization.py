# tests/test_school_normalization.py
#
# Unit tests for app.normalization.base_strategy and the per-school
# strategies in app.normalization.schools/* — pure school-year parsing
# rules and (for PUP/SVCC/UPHSD) block-merging preprocessing.

import pytest

from app.models import OcrBlock
from app.normalization import get_strategy_for_school, SCHOOL_STRATEGY_REGISTRY
from app.normalization.base_strategy import BaseSchoolStrategy
from app.normalization.schools.pnc import PamantasanNgCabuyaoStrategy
from app.normalization.schools.sti_calamba import StiCalambaStrategy
from app.normalization.schools.svcc import StVincentCabuyaoStrategy
from app.normalization.schools.pup import PupStrategy
from app.normalization.schools.uphsd import UphsdStrategy
from app.normalization.schools.cdc import CalambaDoctorsCollegeStrategy
from app.normalization.schools.nu import NuStrategy
from app.normalization.schools.uplb import UplbStrategy


def block(text, x_min=0, y_min=0, x_max=100, y_max=20, conf=0.9):
    return OcrBlock(text=text, confidence=conf, x_min=x_min, y_min=y_min, x_max=x_max, y_max=y_max)


# ── BaseSchoolStrategy ──────────────────────────────────────────────────

def test_base_strategy_extracts_full_range_format():
    s = BaseSchoolStrategy()
    assert s.extract_school_year("SY 2025-2026") == "2025-2026"


def test_base_strategy_extracts_range_with_junk_separator():
    s = BaseSchoolStrategy()
    assert s.extract_school_year("2025 to 2026") == "2025-2026"


def test_base_strategy_extracts_short_end_year_format():
    s = BaseSchoolStrategy()
    assert s.extract_school_year("2025-26") == "2025-2026"


def test_base_strategy_single_year_with_start_hint():
    s = BaseSchoolStrategy()
    assert s.extract_school_year("2025", sy_format_hint="single_year_as_start") == "2025-2026"


def test_base_strategy_single_year_with_end_hint():
    s = BaseSchoolStrategy()
    assert s.extract_school_year("2025", sy_format_hint="single_year_as_end") == "2024-2025"


def test_base_strategy_single_year_no_hint_returns_none():
    s = BaseSchoolStrategy()
    assert s.extract_school_year("2025") is None


def test_base_strategy_empty_text_returns_none():
    s = BaseSchoolStrategy()
    assert s.extract_school_year("") is None
    assert s.extract_school_year(None) is None


def test_base_strategy_no_year_pattern_returns_none():
    s = BaseSchoolStrategy()
    assert s.extract_school_year("no digits here at all") is None


def test_base_strategy_preprocess_blocks_is_passthrough():
    s = BaseSchoolStrategy()
    blocks = [block("A"), block("B")]
    assert s.preprocess_blocks(blocks) == blocks


# ── get_strategy_for_school() registry ──────────────────────────────────

def test_get_strategy_for_school_known_school():
    assert isinstance(get_strategy_for_school("STI College Calamba"), StiCalambaStrategy)


def test_get_strategy_for_school_unknown_falls_back_to_base():
    strategy = get_strategy_for_school("Some Random School")
    assert type(strategy) is BaseSchoolStrategy


def test_get_strategy_for_school_aliases_map_to_same_strategy_type():
    assert type(get_strategy_for_school("SVCC")) is type(get_strategy_for_school("St. Vincent College of Cabuyao"))
    assert type(get_strategy_for_school("PUP")) is type(get_strategy_for_school("Polytechnic University of the Philippines"))
    assert type(get_strategy_for_school("University of Cabuyao")) is type(get_strategy_for_school("Pamantasan ng Cabuyao"))
    assert type(get_strategy_for_school("Calamba Doctors College")) is type(get_strategy_for_school("Calamba Doctor's College"))
    assert type(get_strategy_for_school("University of Perpetual Help System DALTA Calamba")) is type(get_strategy_for_school("University of Perpetual Help System DALTA"))
    assert type(get_strategy_for_school("Perpetual Help Calamba")) is type(get_strategy_for_school("University of Perpetual Help System DALTA"))
    assert type(get_strategy_for_school("UPLB")) is type(get_strategy_for_school("University of the Philippines Los Baños"))


# ── PamantasanNgCabuyaoStrategy (PNC) ────────────────────────────────────

def test_pnc_extracts_academic_year_phrase():
    s = PamantasanNgCabuyaoStrategy()
    assert s.extract_school_year("Academic Year 2024-2025") == "2024-2025"


def test_pnc_academic_year_phrase_is_case_insensitive_and_spacing_tolerant():
    s = PamantasanNgCabuyaoStrategy()
    assert s.extract_school_year("academic   year   2024-2025") == "2024-2025"
    assert s.extract_school_year("ACADEMICYEAR2024 - 2025") == "2024-2025"


def test_pnc_falls_back_to_base_strategy_when_no_academic_year_phrase():
    s = PamantasanNgCabuyaoStrategy()
    assert s.extract_school_year("SY 2024-2025") == "2024-2025"


# ── StiCalambaStrategy ───────────────────────────────────────────────────

def test_sti_decodes_term_code():
    s = StiCalambaStrategy()
    sy, term = s.decode_sti_term_code("2425/1T")
    assert sy == "2024-2025"
    assert term == "1"


def test_sti_decode_term_code_second_term():
    s = StiCalambaStrategy()
    sy, term = s.decode_sti_term_code("2526/2t")
    assert sy == "2025-2026"
    assert term == "2"


def test_sti_decode_term_code_no_match_returns_none_none():
    s = StiCalambaStrategy()
    assert s.decode_sti_term_code("no code here") == (None, None)


def test_sti_extract_school_year_uses_term_code():
    s = StiCalambaStrategy()
    assert s.extract_school_year("Header 2425/1T Footer") == "2024-2025"


def test_sti_extract_school_year_falls_back_to_base_strategy():
    s = StiCalambaStrategy()
    assert s.extract_school_year("SY 2024-2025") == "2024-2025"


# ── StVincentCabuyaoStrategy (SVCC) ───────────────────────────────────────

def test_svcc_single_year_interpreted_as_start_of_range():
    s = StVincentCabuyaoStrategy()
    assert s.extract_school_year("School Year: 2025") == "2025-2026"


def test_svcc_full_range_format_still_handled_by_regex_first():
    s = StVincentCabuyaoStrategy()
    # regex looks for a single bare year -- first 20xx match wins
    assert s.extract_school_year("2025-2026") == "2025-2026"


def test_svcc_no_year_returns_none():
    s = StVincentCabuyaoStrategy()
    assert s.extract_school_year("no year present") is None


def test_svcc_merges_header_split_across_two_blocks():
    s = StVincentCabuyaoStrategy()
    b1 = block("ST.VINCENT", x_min=0, y_min=0, x_max=100, y_max=20, conf=0.8)
    b2 = block("COLLEGE OF CABUYAO", x_min=0, y_min=25, x_max=150, y_max=45, conf=0.9)
    other = block("Unrelated line", x_min=0, y_min=50, x_max=100, y_max=70)
    merged = s.preprocess_blocks([b1, b2, other])
    merged_texts = [b.text for b in merged]
    assert "ST.VINCENT COLLEGE OF CABUYAO" in merged_texts
    assert "Unrelated line" in merged_texts
    assert len(merged) == 2  # b1+b2 merged into one, other untouched


def test_svcc_preprocess_blocks_no_header_found_passthrough():
    s = StVincentCabuyaoStrategy()
    blocks = [block("Random text")]
    assert s.preprocess_blocks(blocks) == blocks


def test_svcc_preprocess_blocks_only_one_header_keyword_is_passthrough():
    s = StVincentCabuyaoStrategy()
    blocks = [block("Cabuyao only")]
    assert s.preprocess_blocks(blocks) == blocks


# ── PupStrategy ───────────────────────────────────────────────────────────

def test_pup_merges_institution_header_split_across_lines():
    s = PupStrategy()
    b1 = block("POLYTECHNIC", x_min=0, y_min=0, x_max=100, y_max=20)
    b2 = block("UNIVERSITY", x_min=0, y_min=25, x_max=100, y_max=45)
    b3 = block("PHILIPPINES", x_min=0, y_min=50, x_max=100, y_max=70)
    noise = block("eftf", x_min=0, y_min=75, x_max=50, y_max=95)
    merged = s.preprocess_blocks([b1, b2, b3, noise])
    merged_texts = [b.text for b in merged]
    assert "POLYTECHNIC UNIVERSITY PHILIPPINES" in merged_texts
    assert "eftf" in merged_texts  # noise untouched, not part of institution header


def test_pup_header_merge_requires_at_least_two_keyword_blocks():
    s = PupStrategy()
    blocks = [block("POLYTECHNIC")]
    assert s.preprocess_blocks(blocks) == blocks


def test_pup_merges_name_lines_above_student_number():
    s = PupStrategy()
    student_no = block("2023-00000-AB-0", x_min=0, y_min=100, x_max=150, y_max=120)
    name_line1 = block("JEAN GRAY B.", x_min=0, y_min=60, x_max=150, y_max=80)
    name_line2 = block("HEMENEZ", x_min=0, y_min=80, x_max=150, y_max=100)
    unrelated = block("Far away photo caption", x_min=0, y_min=-500, x_max=150, y_max=-480)
    merged = s.preprocess_blocks([student_no, name_line1, name_line2, unrelated])
    merged_texts = [b.text for b in merged]
    assert "JEAN GRAY B. HEMENEZ" in merged_texts
    assert "2023-00000-AB-0" in merged_texts


def test_pup_no_student_number_anchor_leaves_name_lines_untouched():
    s = PupStrategy()
    blocks = [block("JEAN GRAY B."), block("HEMENEZ")]
    result = s.preprocess_blocks(blocks)
    assert [b.text for b in result] == ["JEAN GRAY B.", "HEMENEZ"]


# ── UphsdStrategy ─────────────────────────────────────────────────────────

def test_uphsd_merges_institution_header_exact_keywords():
    s = UphsdStrategy()
    b1 = block("UNIVERSITY OF", x_min=0, y_min=0, x_max=100, y_max=20)
    b2 = block("PERPETUAL HELP SYSTEM DALTA", x_min=0, y_min=25, x_max=150, y_max=45)
    merged = s.preprocess_blocks([b1, b2])
    merged_texts = [b.text for b in merged]
    assert "UNIVERSITY OF PERPETUAL HELP SYSTEM DALTA" in merged_texts


def test_uphsd_merges_institution_header_with_ocr_typo_fuzzy_match():
    s = UphsdStrategy()
    b1 = block("UNIVERSITY OF", x_min=0, y_min=0, x_max=100, y_max=20)
    b2 = block("PERPETOAL HELP SYSTEM DALTA", x_min=0, y_min=25, x_max=150, y_max=45)  # OCR typo
    merged = s.preprocess_blocks([b1, b2])
    merged_texts = [b.text for b in merged]
    assert any("PERPETOAL" in t for t in merged_texts)


def test_uphsd_merges_bottom_name_lines_above_student_number():
    s = UphsdStrategy()
    # candidate lines must have y_center >= anchor.y_center - anchor.height,
    # so keep them within one anchor-height above the student number block
    student_no = block("12-3456-789", x_min=0, y_min=200, x_max=150, y_max=260)  # height=60
    name1 = block("Juan Dela", x_min=0, y_min=172, x_max=150, y_max=192)   # y_center=182
    name2 = block("Cruz", x_min=0, y_min=194, x_max=150, y_max=214)        # y_center=204
    merged = s.preprocess_blocks([student_no, name1, name2])
    merged_texts = [b.text for b in merged]
    assert "Juan Dela Cruz" in merged_texts


def test_uphsd_bottom_name_merge_excludes_course_line():
    s = UphsdStrategy()
    student_no = block("12-3456-789", x_min=0, y_min=140, x_max=150, y_max=160)
    course = block("College of Engineering", x_min=0, y_min=100, x_max=150, y_max=120)
    name1 = block("Juan Dela", x_min=0, y_min=115, x_max=150, y_max=135)
    name2 = block("Cruz", x_min=0, y_min=135, x_max=150, y_max=155)
    merged = s.preprocess_blocks([student_no, course, name1, name2])
    merged_texts = [b.text for b in merged]
    assert "College of Engineering" in merged_texts  # excluded from name merge, kept as-is


# ── CalambaDoctorsCollegeStrategy (CDC) ──────────────────────────────────

def test_cdc_extracts_ay_phrase():
    s = CalambaDoctorsCollegeStrategy()
    assert s.extract_school_year("1st Semester AY 2024-2025") == "2024-2025"


def test_cdc_ay_phrase_is_case_insensitive_and_spacing_tolerant():
    s = CalambaDoctorsCollegeStrategy()
    assert s.extract_school_year("ay   2024   -   2025") == "2024-2025"
    assert s.extract_school_year("AY2024-2025") == "2024-2025"


def test_cdc_falls_back_to_base_strategy_when_no_ay_phrase():
    s = CalambaDoctorsCollegeStrategy()
    assert s.extract_school_year("SY 2024-2025") == "2024-2025"


# ── NuStrategy ────────────────────────────────────────────────────────────

def test_nu_extracts_school_year_phrase():
    s = NuStrategy()
    assert s.extract_school_year("School Year: 2024-2025\nTerm: 1") == "2024-2025"


def test_nu_school_year_phrase_is_case_insensitive_and_spacing_tolerant():
    s = NuStrategy()
    assert s.extract_school_year("school   year   2024-2025") == "2024-2025"
    assert s.extract_school_year("SCHOOLYEAR:2024-2025") == "2024-2025"


def test_nu_falls_back_to_base_strategy_when_no_school_year_phrase():
    s = NuStrategy()
    assert s.extract_school_year("SY 2024-2025") == "2024-2025"


# ── UplbStrategy ──────────────────────────────────────────────────────────

def test_uplb_extracts_sy_with_year_a_few_words_later():
    s = UplbStrategy()
    assert s.extract_school_year("TERM & SY\nFirst Semester,\n2025-2026") == "2025-2026"


def test_uplb_extracts_sy_immediately_adjacent_to_year():
    s = UplbStrategy()
    assert s.extract_school_year("SY 2025-2026") == "2025-2026"


def test_uplb_sy_too_far_from_year_does_not_match_falls_back_to_base():
    s = UplbStrategy()
    # base strategy's generic pattern still finds the bare year pair
    text = "SY " + ("x" * 100) + " 2025-2026"
    assert s.extract_school_year(text) == "2025-2026"


def test_uplb_falls_back_to_base_strategy_when_no_sy_token():
    s = UplbStrategy()
    assert s.extract_school_year("Academic Year 2025-2026") == "2025-2026"
