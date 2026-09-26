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

# Central registry mapping the dropdown option strings to their strategies.
# Aliases of the SAME school below MUST share one strategy INSTANCE (not
# just the same class) -- get_known_school_names() dedupes/excludes by
# id(strategy) for the "which OTHER school is this" cross-check, so two
# separately-constructed instances of e.g. StVincentCabuyaoStrategy() would
# look like two different schools and let "SVCC" get offered back as a
# candidate mismatch against the very same declared school "St. Vincent
# College of Cabuyao" -- confirmed as a real false positive, not
# hypothetical: a real SVCC Registration Form correctly declared as
# "St. Vincent College of Cabuyao" was auto-flagged as institution_mismatch
# ("appears to be SVCC instead") for exactly this reason.
_pnc = PamantasanNgCabuyaoStrategy()
_svcc = StVincentCabuyaoStrategy()
_pup = PupStrategy()
_uphsd = UphsdStrategy()
_cdc = CalambaDoctorsCollegeStrategy()
_nu = NuStrategy()
_uplb = UplbStrategy()

SCHOOL_STRATEGY_REGISTRY = {
    "STI College Calamba": StiCalambaStrategy(),
    "Pamantasan ng Cabuyao": _pnc,
    "University of Cabuyao": _pnc,
    "St. Vincent College of Cabuyao": _svcc,
    "SVCC": _svcc,
    "Polytechnic University of the Philippines": _pup,
    "PUP": _pup,
    "University of Perpetual Help System DALTA": _uphsd,
    "University of Perpetual Help System DALTA Calamba": _uphsd,
    "Perpetual Help Calamba": _uphsd,
    "Calamba Doctor's College": _cdc,
    "Calamba Doctors College": _cdc,
    "NU": _nu,
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
    "National University": _nu,
    "UPLB": _uplb,
    "University of the Philippines Los Baños": _uplb,

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
    "University of the Philippines": BaseSchoolStrategy(),
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
#
# Returns EVERY non-excluded alias, not one deduped name per school --
# both callers (school.py's "which OTHER school is this" cross-check)
# only ever try each returned name as a MATCH CANDIDATE and keep
# whichever single one actually scores best, so there's no list ever
# shown to a user raw that duplicate aliases could clutter. A prior
# version deduped down to "the longest alias per strategy" specifically
# to avoid that (nonexistent) display clutter -- confirmed as a real bug,
# not just redundant caution: "Pamantasan ng Cabuyao" and "University of
# Cabuyao" tie at 21 characters, so that dedup arbitrarily kept only
# "Pamantasan ng Cabuyao" (inserted first) and silently discarded
# "University of Cabuyao" -- on a real Registration Form whose header
# read exactly "UNIVERSITY OF CABUYAO", the surviving alias shares only
# the word "Cabuyao" with that header (fails fuzzy_match_school), while
# the discarded one would have matched it almost verbatim. That let a
# genuine wrong-school upload (declared SVCC, header confidently showing
# a real, different, KNOWN school) pass as an undetected institution
# mismatch, purely because of which same-length alias happened to be
# registered first.
def get_known_school_names(exclude: str = None) -> list:
    """
    Returns every registered alias except those of `exclude`'s own
    school (i.e. every alias mapping to the same strategy instance, not
    just the literal string) -- so e.g. excluding "PUP" also excludes
    "Polytechnic University of the Philippines", the same school under
    its full name.
    """
    exclude_strategy_id = id(SCHOOL_STRATEGY_REGISTRY[exclude]) if exclude in SCHOOL_STRATEGY_REGISTRY else None
    return [
        name for name, strategy in SCHOOL_STRATEGY_REGISTRY.items()
        if id(strategy) != exclude_strategy_id
    ]


