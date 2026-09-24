from app.template_checks.base_strategy import BaseTemplateStrategy
from app.template_checks.schools.pnc import PncRegFormTemplateStrategy, PncIdTemplateStrategy
from app.template_checks.schools.pup import PupRegFormTemplateStrategy, PupIdTemplateStrategy
from app.template_checks.schools.svcc import SvccRegFormTemplateStrategy
from app.template_checks.schools.uplb import UplbRegFormTemplateStrategy
from app.template_checks.comelec import ComelecVotersCertTemplateStrategy

# Registry mapping (school_name, document_type) -> template strategy, for
# documents where the expected layout differs per school (Reg Form, School ID).
#
# Coverage is intentionally partial: each strategy below was built and
# verified against real OCR'd sample documents (see SeedOcrUiSamplesSeeder).
# STI (no real Reg Form/School ID samples available) and CDC/NU/UPHSD (no
# real samples of any kind, despite having normalization strategies in
# app/normalization/schools/) are NOT registered here -- writing a
# strategy without real documents to validate against risks rejecting
# genuine uploads, which is worse than the current permissive fallback.
# Same for SVCC/UPLB School ID and STI's document types generally: no
# samples, so no strategy. These fall through to BaseTemplateStrategy()
# below until real sample docs are collected for them.
TEMPLATE_STRATEGY_REGISTRY = {
    ("Pamantasan ng Cabuyao", "registration_form"): PncRegFormTemplateStrategy(),
    ("University of Cabuyao", "registration_form"): PncRegFormTemplateStrategy(),
    ("Pamantasan ng Cabuyao", "school_id"): PncIdTemplateStrategy(),
    ("University of Cabuyao", "school_id"): PncIdTemplateStrategy(),
    ("Polytechnic University of the Philippines", "registration_form"): PupRegFormTemplateStrategy(),
    ("PUP", "registration_form"): PupRegFormTemplateStrategy(),
    ("Polytechnic University of the Philippines", "school_id"): PupIdTemplateStrategy(),
    ("PUP", "school_id"): PupIdTemplateStrategy(),
    ("St. Vincent College of Cabuyao", "registration_form"): SvccRegFormTemplateStrategy(),
    ("SVCC", "registration_form"): SvccRegFormTemplateStrategy(),
    ("University of the Philippines Los Baños", "registration_form"): UplbRegFormTemplateStrategy(),
    ("UPLB", "registration_form"): UplbRegFormTemplateStrategy(),
}

# Registry mapping document_type -> template strategy, for documents that
# use a single national/standard format regardless of the applicant's
# declared school (e.g. the COMELEC Voter's Certification).
GENERIC_DOCUMENT_STRATEGIES = {
    "voters_certificate": ComelecVotersCertTemplateStrategy(),
}


def get_template_strategy(school_name: str, document_type: str) -> BaseTemplateStrategy:
    """
    Returns the specialized template strategy if registered for this
    school + document type combo. Falls back to a generic strategy keyed
    only by document_type (for school-independent formats). If neither
    is registered, falls back to a permissive base strategy (no
    required_keywords = no flags raised).
    """
    specific = TEMPLATE_STRATEGY_REGISTRY.get((school_name, document_type))
    if specific:
        return specific

    generic = GENERIC_DOCUMENT_STRATEGIES.get(document_type)
    if generic:
        return generic

    return BaseTemplateStrategy()