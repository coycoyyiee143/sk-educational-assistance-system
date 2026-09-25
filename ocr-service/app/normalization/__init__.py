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
    # Full official name, same strategy instance -- registering this
    # matters beyond just letting the dropdown value resolve: without a
    # longer alias, get_known_school_names() (used for "which OTHER
    # school is this" detection) would only ever have the bare 2-letter
    # "NU" to offer, which is exactly the pathologically-short-name class
    # of false positive fixed earlier for fuzzy_match_school (a 2-letter
    # acronym can coincidentally match unrelated text). A real, distinctive
    # full name gives that detection something meaningful to match against.
    # Deliberately just "National University", not "National University
    # Laguna" -- confirmed the actual printed IDs/reg forms only say
    # "National University", no campus suffix, so matching against a
    # name that includes "Laguna" would never find it.
    "National University": NuStrategy(),
    "UPLB": UplbStrategy(),
    "University of the Philippines Los Baños": UplbStrategy(),

    # Every other school on SK's actual declared-school roster --
    # registered here so get_known_school_names() (the "which OTHER
    # school is this" cross-check used by the institution_mismatch
    # auto-reupload tier) can recognize them too, not just the handful
    # with dedicated header-merging strategies. Confirmed as a real gap
    # on a live Registration Form whose header genuinely read "LAGUNA
    # STATE POLYTECHNIC UNIVERSITY" (#9 on this roster) while the
    # declared school ("National University") matched via unrelated body
    # text -- the cross-check found nothing because LSPU had never been
    # registered anywhere, silently passing an institution mismatch.
    # Each gets ITS OWN BaseSchoolStrategy() instance (not one shared
    # instance) because get_known_school_names() dedupes by id(strategy)
    # -- sharing one instance across all of these would collapse them
    # into a single entry.
    "AMA Computer College": BaseSchoolStrategy(),
    "Batangas State University": BaseSchoolStrategy(),
    "Calamba Institute": BaseSchoolStrategy(),
    "City College of Calamba": BaseSchoolStrategy(),
    "Colegio de San Juan de Letran": BaseSchoolStrategy(),
    "Don Bosco College": BaseSchoolStrategy(),
    "Laguna Colleges of Business and Arts": BaseSchoolStrategy(),
    "Laguna State Polytechnic University": BaseSchoolStrategy(),
    "Lyceum of the Philippines": BaseSchoolStrategy(),
    "Mapua-Malayan College of Laguna": BaseSchoolStrategy(),
    "Our Lady of Assumption College": BaseSchoolStrategy(),
    "PHINMA Rizal College of Laguna": BaseSchoolStrategy(),
    "St. Ignatius": BaseSchoolStrategy(),
    "St. Michael College of Laguna": BaseSchoolStrategy(),
    "Philippine Women's University": BaseSchoolStrategy(),
    "University of Perpetual Help System JONELTA Biñan": BaseSchoolStrategy(),
    "University of Perpetual Help Las Piñas": BaseSchoolStrategy(),
    "Unibersidad ng Pilipinas": BaseSchoolStrategy(),
    "Westbridge Institute of Technology": BaseSchoolStrategy(),
    "Our Lady of Fatima University": BaseSchoolStrategy(),
    "Saint Benilde International School": BaseSchoolStrategy(),
    "San Pedro College": BaseSchoolStrategy(),
    "Trimex College of Biñan": BaseSchoolStrategy(),
    "STI Santa Rosa": BaseSchoolStrategy(),
    "Arellano University": BaseSchoolStrategy(),
    "Philippine Merchant Marine School": BaseSchoolStrategy(),
    "PNTC College": BaseSchoolStrategy(),
    "Saint John and Paul Educational Foundation Inc.": BaseSchoolStrategy(),
    "Pamantasan ng Lungsod ng Maynila": BaseSchoolStrategy(),
    "Pamantasan ng Lungsod ng Muntinlupa": BaseSchoolStrategy(),
    "St. John Colleges": BaseSchoolStrategy(),
    "Citi Global Colleges": BaseSchoolStrategy(),
    "Philippine Nautical Technology": BaseSchoolStrategy(),
    "Far Eastern University": BaseSchoolStrategy(),
    "University of Santo Tomas": BaseSchoolStrategy(),
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