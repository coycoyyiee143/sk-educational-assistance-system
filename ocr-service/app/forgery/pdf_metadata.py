from dataclasses import dataclass, field
from typing import List, Optional
from difflib import SequenceMatcher

try:
    import pikepdf
    PIKEPDF_AVAILABLE = True
except ImportError:
    PIKEPDF_AVAILABLE = False


@dataclass
class PdfMetadataResult:
    passed: bool
    flags: List[str] = field(default_factory=list)
    score: float = 1.0


def describe_pdf_metadata_score(score: float) -> str:
    if score >= 1.0:
        return "No Suspicious Authoring Signals Detected"
    return "Document Origin Signals Warrant Review"


# Design/editing tools only — deliberately excludes word processors
# (Word, LibreOffice, Google Docs, etc.), since a school registrar
# exporting a Registration Form from Word to PDF is completely normal
# and would otherwise flag every legitimate registrar-issued document
# as "suspicious" alongside actual forgery tools.
SUSPICIOUS_TOOLS = [
    "canva", "figma", "photoshop", "illustrator", "gimp",
    "sketch", "inkscape", "coreldraw", "affinity",
]


def _names_match(author: str, applicant_name: str, threshold: float = 0.5) -> bool:
    if not author or not applicant_name:
        return True
    ratio = SequenceMatcher(None, author.lower().strip(), applicant_name.lower().strip()).ratio()
    return ratio >= threshold


def check_pdf_metadata(file_path: str, applicant_name: Optional[str] = None) -> PdfMetadataResult:
    if not PIKEPDF_AVAILABLE:
        return PdfMetadataResult(passed=True, flags=[], score=1.0)

    if not file_path.lower().endswith('.pdf'):
        return PdfMetadataResult(passed=True, flags=[], score=1.0)

    flags: List[str] = []
    try:
        pdf = pikepdf.open(file_path)
        producer = str(pdf.docinfo.get('/Producer', '')).lower()
        creator = str(pdf.docinfo.get('/Creator', '')).lower()
        author = str(pdf.docinfo.get('/Author', ''))
        combined = f"{producer} {creator}"

        for tool in SUSPICIOUS_TOOLS:
            if tool in combined:
                flags.append(f"PDF metadata indicates it was created using: {tool.title()}")
                break

        if author and not _names_match(author, applicant_name or ""):
            flags.append(f"File author metadata ('{author}') does not resemble the applicant's name")
    except Exception:
        pass

    score = max(0.0, 1.0 - (0.5 * len(flags)))
    return PdfMetadataResult(passed=len(flags) == 0, flags=flags, score=score)