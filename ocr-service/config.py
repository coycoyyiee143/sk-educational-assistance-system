import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    DEBUG = os.getenv("FLASK_DEBUG", False)
    LARAVEL_API_URL = os.getenv("LARAVEL_API_URL", "http://localhost:8000/api")
    LARAVEL_INTERNAL_TOKEN = os.getenv("LARAVEL_INTERNAL_TOKEN", "")

    OCR_CONFIDENCE_THRESHOLD = 0.75
    FUZZY_AUTO_PASS_THRESHOLD = 85
    LOW_CONFIDENCE_FLAG = True

    KNOWN_SCHOOLS = [
        # Cabuyao
        "Pamantasan ng Cabuyao",
        "University of Cabuyao",
        "Mapúa Malayan Colleges Laguna",
        "Mapua Malayan Colleges Laguna",
        "St. Vincent College of Cabuyao",
        "Our Lady of Assumption College",
        "Colegio de Sto. Niño de Cabuyao",
        # Calamba
        "Calamba Doctor's College",
        "Calamba Doctors College",
        "STI College Calamba",
        "University of Perpetual Help System DALTA Calamba",
        "Perpetual Help Calamba",
        # Los Baños
        "University of the Philippines Los Baños",
        "UPLB",
        # Others in Laguna
        "Colegio de San Juan de Letran Calamba",
        "De La Salle University Canlubang",
        "Lyceum of the Philippines University Laguna",
        "LPU Calamba",
        "Laguna College of Business and Arts",
        "LCBA",
        "Dominican College of Santa Rosa",
        "AMA Computer College Calamba",
        "Polytechnic University of the Philippines Santa Rosa",
        "PUP Santa Rosa",
    ]

    # Per-school format reference — DOCUMENTATION ONLY.
    # Not read at runtime; actual extraction logic lives in normalization/base_strategy.py
    # and normalization/schools/*.py. Only confirmed-format schools are listed here;
    # add entries back once a real sample form is reviewed for each remaining school.
    SCHOOL_FORMAT_RULES = {
        "Pamantasan ng Cabuyao": {
            # Format: First/Second Semester, Academic Year 20XX-20XX
            "sy_format": "YYYY-YYYY",
            "sy_keywords": ["academic year"],
        },
        "University of Cabuyao": {
            # Format: First/Second Semester, Academic Year 20XX-20XX
            "sy_format": "YYYY-YYYY",
            "sy_keywords": ["academic year"],
        },
        "St. Vincent College of Cabuyao": {
            # Format: School Year: 20XX | Semester: 1st/2nd
            "sy_format": "single_year_as_start",
            "sy_keywords": ["school year"],
        },
        "Calamba Doctor's College": {
            # Format: "1st/2nd Semester AY 20XX - 20XX"
            "sy_format": "YYYY-YYYY",
            "sy_keywords": ["ay"],
        },
        "Calamba Doctors College": {
            # Format: "1st/2nd Semester AY 20XX - 20XX"
            "sy_format": "YYYY-YYYY",
            "sy_keywords": ["ay"],
        },
        "STI College Calamba": {
            # Format: "SY & Term: 2X2X/XT" (e.g. "2526/2T") — handled by dedicated
            # decode_sti_term_code() regex, NOT the generic YYYY-YYYY pattern
            "sy_format": "sis_code",
            "sy_keywords": ["sy", "term"],
        },
        "University of Perpetual Help System DALTA Calamba": {
            # Format: Sem   Sch. Yr.
            #         1st/2nd   20XX-20XX
            "sy_format": "YYYY-YYYY",
            "sy_keywords": ["sch. yr.", "sch yr"],
        },
        "Perpetual Help Calamba": {
            # Format: Sem   Sch. Yr.
            #         1st/2nd   20XX-20XX
            "sy_format": "YYYY-YYYY",
            "sy_keywords": ["sch. yr.", "sch yr"],
        },
    }