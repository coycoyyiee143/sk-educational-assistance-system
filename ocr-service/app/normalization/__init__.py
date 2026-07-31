# app/normalization/__init__.py
from app.normalization.base_strategy import BaseSchoolStrategy
from app.normalization.schools.sti_calamba import StiCalambaStrategy
from app.normalization.schools.pnc import PamantasanNgCabuyaoStrategy
from app.normalization.schools.svcc import StVincentCabuyaoStrategy
from app.normalization.schools.pup import PupStrategy

# Central registry mapping the dropdown option strings to their strategies
SCHOOL_STRATEGY_REGISTRY = {
    "STI College Calamba": StiCalambaStrategy(),
    "Pamantasan ng Cabuyao": PamantasanNgCabuyaoStrategy(),
    "University of Cabuyao": PamantasanNgCabuyaoStrategy(),
    "St. Vincent College of Cabuyao": StVincentCabuyaoStrategy(),
    "SVCC": StVincentCabuyaoStrategy(),
    "Polytechnic University of the Philippines": PupStrategy(),
    "PUP": PupStrategy(),
}

def get_strategy_for_school(school_name: str) -> BaseSchoolStrategy:
    """
    Returns the specialized school strategy wrapper if registered,
    otherwise falls back to generic multi-pattern string routines.
    """
    return SCHOOL_STRATEGY_REGISTRY.get(school_name, BaseSchoolStrategy())