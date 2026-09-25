# tests/test_template_checks.py
#
# Unit tests for app.template_checks.base_strategy (fuzzy_contains,
# describe_score, BaseTemplateStrategy.check) and the concrete strategies
# in comelec.py / schools/pnc.py.

import pytest

from app.models import OcrBlock
from app.template_checks.base_strategy import (
    fuzzy_contains,
    describe_score,
    BaseTemplateStrategy,
    TemplateCheckResult,
)
from app.template_checks.comelec import ComelecVotersCertTemplateStrategy
from app.template_checks.schools.pnc import PncRegFormTemplateStrategy, PncIdTemplateStrategy
from app.template_checks.schools.pup import PupRegFormTemplateStrategy, PupIdTemplateStrategy
from app.template_checks.schools.svcc import SvccRegFormTemplateStrategy
from app.template_checks.schools.uplb import UplbRegFormTemplateStrategy
from app.template_checks import get_template_strategy, TEMPLATE_STRATEGY_REGISTRY, GENERIC_DOCUMENT_STRATEGIES


def block(text, x_min=0, y_min=0, x_max=200, y_max=20, conf=0.9):
    return OcrBlock(text=text, confidence=conf, x_min=x_min, y_min=y_min, x_max=x_max, y_max=y_max)


# ── fuzzy_contains() ───────────────────────────────────────────────────

def test_fuzzy_contains_exact_substring():
    assert fuzzy_contains("this is a voter's certification form", "voter's certification") is True


def test_fuzzy_contains_tolerates_ocr_letter_corruption():
    # "Cabuyao" -> "Cabupao" style single-letter OCR corruption
    assert fuzzy_contains("pamantasan ng cabupao", "cabuyao", threshold=0.75) is True


def test_fuzzy_contains_matches_unspaced_merged_keyword():
    assert fuzzy_contains("(pamantasanngcabuyao)", "pamantasan ng cabuyao") is True


def test_fuzzy_contains_no_match_for_unrelated_text():
    assert fuzzy_contains("completely unrelated document text", "voter's certification", threshold=0.9) is False


def test_fuzzy_contains_respects_threshold_strictness():
    text = "registration type: new"
    # "registration form" shares only the word "registration" with this text
    assert fuzzy_contains(text, "registration form", threshold=0.9) is False


# ── describe_score() ─────────────────────────────────────────────────────

def test_describe_score_perfect():
    assert describe_score(1.0) == "Layout Matches Expected Format"


def test_describe_score_minor_deviation():
    assert describe_score(0.8) == "Minor Layout Deviation"


def test_describe_score_moderate_deviation():
    assert describe_score(0.6) == "Moderate Layout Deviation"


def test_describe_score_significant_deviation():
    assert describe_score(0.3) == "Significant Layout Deviation"


# ── BaseTemplateStrategy.check() ─────────────────────────────────────────

class _SingleKeywordStrategy(BaseTemplateStrategy):
    required_keywords = ["voter's certification"]


class _GroupKeywordStrategy(BaseTemplateStrategy):
    required_keyword_groups = [["university of cabuyao", "pamantasan ng cabuyao"]]


def test_base_strategy_passes_when_required_keyword_present():
    strategy = _SingleKeywordStrategy()
    blocks = [block("Voter's Certification"), block("Commission on Elections")]
    result = strategy.check(blocks)
    assert isinstance(result, TemplateCheckResult)
    assert result.passed is True
    assert result.flags == []
    assert result.score == pytest.approx(1.0)


def test_base_strategy_fails_when_required_keyword_missing():
    strategy = _SingleKeywordStrategy()
    blocks = [block("Registration Form")]
    result = strategy.check(blocks)
    assert result.passed is False
    assert len(result.flags) == 1
    assert "voter's certification" in result.flags[0]
    assert result.score == pytest.approx(0.8)


def test_base_strategy_score_drops_by_point_two_per_flag():
    class _MultiKeywordStrategy(BaseTemplateStrategy):
        required_keywords = ["keyword one", "keyword two", "keyword three"]

    strategy = _MultiKeywordStrategy()
    blocks = [block("nothing relevant")]
    result = strategy.check(blocks)
    assert len(result.flags) == 3
    assert result.score == pytest.approx(0.4)


def test_base_strategy_keyword_group_passes_with_any_one_alternative():
    strategy = _GroupKeywordStrategy()
    blocks = [block("Pamantasan ng Cabuyao Student ID")]
    result = strategy.check(blocks)
    assert result.passed is True


def test_base_strategy_keyword_group_fails_when_none_present():
    strategy = _GroupKeywordStrategy()
    blocks = [block("Some other school ID")]
    result = strategy.check(blocks)
    assert result.passed is False
    assert "one of" in result.flags[0]


def test_base_strategy_region_hint_flags_wrong_region():
    class _RegionStrategy(BaseTemplateStrategy):
        required_keywords = ["registration form"]
        region_hints = {"registration form": "top"}
        fuzzy_threshold = 0.75

    strategy = _RegionStrategy()
    # keyword present but near the bottom of a 1000-tall page
    blocks = [block("Registration Form", x_min=0, y_min=950, x_max=200, y_max=980)]
    result = strategy.check(blocks)
    assert result.passed is False
    assert any("not where it normally appears" in f for f in result.flags)


def test_base_strategy_region_hint_passes_when_in_expected_region():
    class _RegionStrategy(BaseTemplateStrategy):
        required_keywords = ["registration form"]
        region_hints = {"registration form": "top"}
        fuzzy_threshold = 0.75

    strategy = _RegionStrategy()
    blocks = [
        block("Registration Form", x_min=0, y_min=0, x_max=200, y_max=20),
        block("Footer text", x_min=0, y_min=980, x_max=200, y_max=1000),  # establishes page height
    ]
    result = strategy.check(blocks)
    assert result.passed is True


def test_base_strategy_default_permissive_with_no_required_keywords():
    strategy = BaseTemplateStrategy()
    result = strategy.check([block("anything at all")])
    assert result.passed is True
    assert result.flags == []


# ── ComelecVotersCertTemplateStrategy ────────────────────────────────────

def test_comelec_strategy_passes_on_genuine_voters_cert():
    strategy = ComelecVotersCertTemplateStrategy()
    blocks = [block("Voter's Certification"), block("Republic of the Philippines")]
    result = strategy.check(blocks)
    assert result.passed is True


def test_comelec_strategy_fails_on_unrelated_document():
    strategy = ComelecVotersCertTemplateStrategy()
    blocks = [block("Registration Form")]
    result = strategy.check(blocks)
    assert result.passed is False


# ── PncRegFormTemplateStrategy / PncIdTemplateStrategy ───────────────────

def test_pnc_reg_form_strategy_passes_with_all_required_text_in_region():
    strategy = PncRegFormTemplateStrategy()
    blocks = [
        block("Registration Form", x_min=0, y_min=0, x_max=200, y_max=20),
        block("Office of the University Registrar", x_min=0, y_min=10, x_max=300, y_max=30),
        block("University Registrar", x_min=0, y_min=950, x_max=200, y_max=980),
    ]
    result = strategy.check(blocks)
    assert result.passed is True


def test_pnc_reg_form_strategy_flags_missing_keyword():
    strategy = PncRegFormTemplateStrategy()
    blocks = [block("Registration Form", x_min=0, y_min=0, x_max=200, y_max=20)]
    result = strategy.check(blocks)
    assert result.passed is False


def test_pnc_id_strategy_passes_with_either_english_or_filipino_name():
    strategy = PncIdTemplateStrategy()
    result_en = strategy.check([block("University of Cabuyao Student ID")])
    result_fil = strategy.check([block("Pamantasan ng Cabuyao Student ID")])
    assert result_en.passed is True
    assert result_fil.passed is True


def test_pnc_id_strategy_fails_with_neither_name():
    strategy = PncIdTemplateStrategy()
    result = strategy.check([block("Some Other University ID")])
    assert result.passed is False


# ── PupRegFormTemplateStrategy / PupIdTemplateStrategy ───────────────────
# Block text below is drawn directly from real OCR output on sample PUP
# documents (RF-001/RF-002, ID-001/ID-002/ID-003 in the seeded OCR test
# set), including the OCR noise/typos actually observed.

def test_pup_reg_form_strategy_passes_on_real_sample_text():
    strategy = PupRegFormTemplateStrategy()
    blocks = [
        block("Republic of the Philippines"),
        block("POLYTECHNIC UNIVERSITY OF THE PHILIPPINES"),
        block("CERTIFICATE OF REGISTRATIONE"),  # real OCR typo, must still fuzzy-match
    ]
    result = strategy.check(blocks)
    assert result.passed is True


def test_pup_reg_form_strategy_flags_missing_keyword():
    strategy = PupRegFormTemplateStrategy()
    blocks = [block("Republic of the Philippines")]
    result = strategy.check(blocks)
    assert result.passed is False


def test_pup_id_strategy_passes_on_badly_garbled_real_header():
    # ID-001: the worst of the 3 real samples checked -- "university" and
    # "polytechnic" fragments are unreadable, only "philippines" survives
    # fuzzy matching at the standard 0.75 threshold.
    strategy = PupIdTemplateStrategy()
    blocks = [
        block("t' HIlIprineS"),
        block("Th i wunies s r\" Jdgteshnni"),
        block("JEAN GRAY B."),
        block("HEMENEZ"),
    ]
    result = strategy.check(blocks)
    assert result.passed is True


def test_pup_id_strategy_passes_on_moderately_garbled_real_header():
    # ID-002: "university" fragment survives, "philippines"/"polytechnic" don't.
    strategy = PupIdTemplateStrategy()
    blocks = [
        block("Polxrsod"),
        block("UNIvERSITN"),
        block("P Ritirrines"),
        block("MARCO ANTONIO G."),
    ]
    result = strategy.check(blocks)
    assert result.passed is True


def test_pup_id_strategy_fails_with_no_matching_keyword():
    strategy = PupIdTemplateStrategy()
    blocks = [block("Some Other School ID"), block("JUAN DELA CRUZ")]
    result = strategy.check(blocks)
    assert result.passed is False


# ── SvccRegFormTemplateStrategy ───────────────────────────────────────────

def test_svcc_reg_form_strategy_passes_on_real_sample_text():
    strategy = SvccRegFormTemplateStrategy()
    blocks = [
        block("SVCC Registration Form"),
        block("ST.VINCENT COLLEGE OF CABUYAO"),
        block("REGISTRATION FORM"),
    ]
    result = strategy.check(blocks)
    assert result.passed is True


def test_svcc_reg_form_strategy_flags_missing_keyword():
    strategy = SvccRegFormTemplateStrategy()
    blocks = [block("SVCC Registration Form")]
    result = strategy.check(blocks)
    assert result.passed is False


# ── UplbRegFormTemplateStrategy ───────────────────────────────────────────

def test_uplb_reg_form_strategy_passes_on_real_sample_text():
    # Institution name never appears (solid-red header line the detector
    # misses entirely) -- these are the UP-specific boilerplate anchors used instead.
    strategy = UplbRegFormTemplateStrategy()
    blocks = [
        block("STUDENT PLEDGE AND DATA PRIVACY REMINDERS"),
        block("I have read and understood the latest UP Privacy Notice for Students."),
        block("RA 10931FREE"),
        block("Form 5 issued by."),
    ]
    result = strategy.check(blocks)
    assert result.passed is True


def test_uplb_reg_form_strategy_flags_missing_keyword():
    strategy = UplbRegFormTemplateStrategy()
    blocks = [block("STUDENT PLEDGE AND DATA PRIVACY REMINDERS")]
    result = strategy.check(blocks)
    assert result.passed is False


# ── get_template_strategy() registry ─────────────────────────────────────

def test_get_template_strategy_school_specific_lookup():
    strategy = get_template_strategy("Pamantasan ng Cabuyao", "registration_form")
    assert isinstance(strategy, PncRegFormTemplateStrategy)


def test_get_template_strategy_generic_document_fallback():
    strategy = get_template_strategy("Any School At All", "voters_certificate")
    assert isinstance(strategy, ComelecVotersCertTemplateStrategy)


def test_get_template_strategy_falls_back_to_permissive_base():
    strategy = get_template_strategy("Unregistered School", "school_id")
    assert type(strategy) is BaseTemplateStrategy


def test_get_template_strategy_pup_reg_form_lookup():
    strategy = get_template_strategy("PUP", "registration_form")
    assert isinstance(strategy, PupRegFormTemplateStrategy)


def test_get_template_strategy_svcc_reg_form_lookup():
    strategy = get_template_strategy("SVCC", "registration_form")
    assert isinstance(strategy, SvccRegFormTemplateStrategy)


def test_get_template_strategy_uplb_reg_form_lookup():
    strategy = get_template_strategy("UPLB", "registration_form")
    assert isinstance(strategy, UplbRegFormTemplateStrategy)


def test_get_template_strategy_sti_still_falls_back_to_permissive_base():
    # No real STI Reg Form/School ID samples exist yet -- must stay
    # unregistered rather than guess at a strategy.
    strategy = get_template_strategy("STI College Calamba", "registration_form")
    assert type(strategy) is BaseTemplateStrategy
