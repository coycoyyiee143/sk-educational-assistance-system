from dataclasses import dataclass, field
from typing import List, Optional

try:
    import c2pa
    C2PA_AVAILABLE = True
except ImportError:
    C2PA_AVAILABLE = False


KNOWN_AI_TOOL_SIGNATURES = [
    "openai", "dall-e", "dalle", "gpt image", "chatgpt",
    "google", "gemini", "synthid", "imagen", "nano banana",
    "midjourney", "stable diffusion", "adobe firefly", "firefly",
]

# Default output filename patterns from AI tools, when the applicant
# uploads a file without renaming it first. Extremely weak signal on its
# own — trivially defeated by a simple rename before upload — but nearly
# free to check, and catches the laziest/least-aware cases.
AI_FILENAME_PATTERNS = [
    "gemini_generated_image",
    "dalle_generated",
    "dall-e_generated",
    "chatgpt_image",
    "chatgpt image",
    "midjourney",
    "stable_diffusion",
    "sdxl_",
    "flux_generated",
]


@dataclass
class ImageMetadataResult:
    passed: bool
    flags: List[str] = field(default_factory=list)
    score: float = 1.0


def describe_image_metadata_score(score: float) -> str:
    if score >= 1.0:
        return "No AI-Generation Provenance Signals Detected"
    return "AI-Generation or Editing Signals Detected"


def _check_c2pa(file_path: str) -> List[str]:
    """
    Reads C2PA Content Credentials, if present. OpenAI (ChatGPT/DALL-E/GPT
    Image) and Google (Gemini) both embed this metadata by default on
    AI-generated or AI-edited images as of 2024-2026. This is a strong
    signal when present — it's the AI provider's own cryptographically
    signed assertion, not a heuristic guess.

    KNOWN LIMITATION: C2PA metadata is fragile by design — converting
    the file format, screenshotting it, sending it through a messaging
    app, or re-saving through many common tools strips it. Absence of a
    C2PA manifest does NOT mean the image wasn't AI-generated; it only
    means either it wasn't made by a C2PA-compliant tool, or the
    metadata was lost along the way. This check can only catch cases
    where the applicant uploaded the AI output close to as-downloaded.
    """
    if not C2PA_AVAILABLE:
        return []
    flags: List[str] = []
    try:
        with c2pa.Reader(file_path) as reader:
            manifest_json = reader.json().lower()
    except Exception:
        # Covers both "no manifest found" (the normal, expected case for
        # a genuine photo) and any read/format error — fail open.
        return []

    for signature in KNOWN_AI_TOOL_SIGNATURES:
        if signature in manifest_json:
            flags.append(f"C2PA content credentials indicate this image was created or edited by: {signature.title()}")
            break
    return flags


def _check_filename(original_filename: Optional[str]) -> List[str]:
    """
    Checks the ORIGINAL client-provided filename (not the server's temp
    file path) against known AI-tool default output naming patterns.

    KNOWN LIMITATION: trivially defeated by a simple rename before
    upload. This only catches applicants who didn't bother renaming the
    file — a real but small subset of cases.
    """
    if not original_filename:
        return []
    lower_name = original_filename.lower()
    for pattern in AI_FILENAME_PATTERNS:
        if pattern in lower_name:
            return [f"Filename matches a known AI-tool default naming pattern: '{original_filename}'"]
    return []


def check_image_metadata(file_path: str, original_filename: Optional[str] = None) -> ImageMetadataResult:
    lower_path = file_path.lower()
    if lower_path.endswith('.pdf'):
        return ImageMetadataResult(passed=True, flags=[], score=1.0)

    c2pa_flags = _check_c2pa(file_path)
    filename_flags = _check_filename(original_filename)

    score = 1.0
    if c2pa_flags:
        score -= 0.8
    if filename_flags:
        score -= 0.2
    score = max(0.0, score)

    all_flags = c2pa_flags + filename_flags
    passed = len(all_flags) == 0
    return ImageMetadataResult(passed=passed, flags=all_flags, score=score)