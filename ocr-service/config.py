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

    # Per-school format rules
    # sy_pattern: what school year format to expect
    # sem_pattern: what semester format to expect
    # sem_keywords: what labels/keywords appear near the semester value
    SCHOOL_FORMAT_RULES = {
        "Pamantasan ng Cabuyao": {
            "sy_format": "YYYY-YYYY",
            "sem_format": "word",
            "sem_keywords": ["semester"],
            "sy_keywords": ["academic year", "a.y.", "ay"],
        },
        "University of Cabuyao": {
            "sy_format": "YYYY-YYYY",
            "sem_format": "word",
            "sem_keywords": ["semester"],
            "sy_keywords": ["academic year", "a.y.", "ay"],
        },
        "St. Vincent College of Cabuyao": {
            "sy_format": "single_year_as_start",
            "sem_format": "ordinal",
            "sem_keywords": ["semester"],
            "sy_keywords": ["school year", "s.y.", "sy", "year"],
        },
        "Calamba Doctor's College": {
            # Form shows: "2nd Semester AY 2025 - 2026"
            "sy_format": "YYYY-YYYY",
            "sem_format": "ordinal",
            "sem_keywords": ["semester"],
            "sy_keywords": ["ay", "a.y.", "academic year"],
        },
        "Calamba Doctors College": {
            "sy_format": "YYYY-YYYY",
            "sem_format": "ordinal",
            "sem_keywords": ["semester"],
            "sy_keywords": ["ay", "a.y.", "academic year"],
        },
        "STI College Calamba": {
            # Form shows: "2526/2T"
            "sy_format": "YYYY-YYYY",
            "sem_format": "sis_code",
            "sem_keywords": ["term", "semester"],
            "sy_keywords": ["school year", "term"],
        },
        "University of Perpetual Help System DALTA Calamba": {
            # Form shows: Sem: 1st, Sch. Yr.: 2025-2026
            "sy_format": "YYYY-YYYY",
            "sem_format": "ordinal",
            "sem_keywords": ["sem", "semester"],
            "sy_keywords": ["sch. yr.", "sch yr", "school year", "sy"],
        },
        "Perpetual Help Calamba": {
            "sy_format": "YYYY-YYYY",
            "sem_format": "ordinal",
            "sem_keywords": ["sem", "semester"],
            "sy_keywords": ["sch. yr.", "sch yr", "school year", "sy"],
        },
        "Mapúa Malayan Colleges Laguna": {
            "sy_format": "YYYY-YYYY",
            "sem_format": "ordinal",
            "sem_keywords": ["semester", "term"],
            "sy_keywords": ["school year", "s.y.", "sy", "academic year"],
        },
        "Mapua Malayan Colleges Laguna": {
            "sy_format": "YYYY-YYYY",
            "sem_format": "ordinal",
            "sem_keywords": ["semester", "term"],
            "sy_keywords": ["school year", "s.y.", "sy", "academic year"],
        },
        "Lyceum of the Philippines University Laguna": {
            "sy_format": "YYYY-YYYY",
            "sem_format": "ordinal",
            "sem_keywords": ["semester", "term"],
            "sy_keywords": ["school year", "s.y."],
        },
        "De La Salle University Canlubang": {
            "sy_format": "YYYY-YYYY",
            "sem_format": "ordinal",
            "sem_keywords": ["school year sem", "semester"],
            "sy_keywords": ["school year sem", "ay", "a.y."],
        },
    }