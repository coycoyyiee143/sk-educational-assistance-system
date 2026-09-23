# app/normalization/__init__.py
from app.normalization.base_strategy import BaseSchoolStrategy
from app.normalization.schools.sti_calamba import StiCalambaStrategy
from app.normalization.schools.pnc import PamantasanNgCabuyaoStrategy
from app.normalization.schools.svcc import StVincentCabuyaoStrategy
from app.normalization.schools.pup import PupStrategy
from app.normalization.schools.uphsd import UphsdStrategy
from app.normalization.schools.cdc import CalambaDoctorsCollegeStrategy
from app.normalization.schools.nu import NuStrategy
from app.normalization.schools.uplb import UplbStrategy

# Central registry mapping the dropdown option strings to their strategies
SCHOOL_STRATEGY_REGISTRY = {
    "STI College Calamba": StiCalambaStrategy(),
    "Pamantasan ng Cabuyao": PamantasanNgCabuyaoStrategy(),
    "University of Cabuyao": PamantasanNgCabuyaoStrategy(),
    "St. Vincent College of Cabuyao": StVincentCabuyaoStrategy(),
    "SVCC": StVincentCabuyaoStrategy(),
    "Polytechnic University of the Philippines": PupStrategy(),
    "PUP": PupStrategy(),
    "University of Perpetual Help System DALTA": UphsdStrategy(),
    "University of Perpetual Help System DALTA Calamba": UphsdStrategy(),
    "Perpetual Help Calamba": UphsdStrategy(),
    "Calamba Doctor's College": CalambaDoctorsCollegeStrategy(),
    "Calamba Doctors College": CalambaDoctorsCollegeStrategy(),
    "NU": NuStrategy(),
    "UPLB": UplbStrategy(),
    "University of the Philippines Los Baños": UplbStrategy(),
}

def get_strategy_for_school(school_name: str) -> BaseSchoolStrategy:
    """
    Returns the specialized school strategy wrapper if registered,
    otherwise falls back to generic multi-pattern string routines.
    """
    return SCHOOL_STRATEGY_REGISTRY.get(school_name, BaseSchoolStrategy())

# The registry above has multiple aliases per school (e.g. "PUP" and
# "Polytechnic University of the Philippines" both point at the same
# strategy) so callers can look up by whatever the applicant selected.
# For displaying "this looks like X" to a user, that same aliasing would
# show duplicates of the same school under different names -- so this
# keeps only the longest (most official-looking) alias per distinct
# strategy instance.
def get_known_school_names(exclude: str = None) -> list:
    """
    Returns one canonical display name per distinct registered school
    strategy. If `exclude` is given, the strategy it maps to (i.e. every
    alias of that same school, not just the literal string) is left out
    -- so e.g. excluding "PUP" also excludes "Polytechnic University of
    the Philippines", the same school under its full name.
    """
    exclude_strategy_id = id(SCHOOL_STRATEGY_REGISTRY[exclude]) if exclude in SCHOOL_STRATEGY_REGISTRY else None
    best_by_strategy = {}
    for name, strategy in SCHOOL_STRATEGY_REGISTRY.items():
        if id(strategy) == exclude_strategy_id:
            continue
        current = best_by_strategy.get(id(strategy))
        if current is None or len(name) > len(current):
            best_by_strategy[id(strategy)] = name
    return list(best_by_strategy.values())