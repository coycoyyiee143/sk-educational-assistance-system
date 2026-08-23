from app.template_checks.base_strategy import BaseTemplateStrategy
from app.template_checks.schools.pnc import PncRegFormTemplateStrategy, PncIdTemplateStrategy
from app.template_checks.comelec import ComelecVotersCertTemplateStrategy

# Registry mapping (school_name, document_type) -> template strategy, for
# documents where the expected layout differs per school (Reg Form, School ID).
TEMPLATE_STRATEGY_REGISTRY = {
    ("Pamantasan ng Cabuyao", "registration_form"): PncRegFormTemplateStrategy(),
    ("University of Cabuyao", "registration_form"): PncRegFormTemplateStrategy(),
    ("Pamantasan ng Cabuyao", "school_id"): PncIdTemplateStrategy(),
    ("University of Cabuyao", "school_id"): PncIdTemplateStrategy(),
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