# test_template.py
# Simpleng test — kinukuha lang natin yung mga text line
# (hindi na natin kailangan ng bbox/coordinates para dito)

from difflib import SequenceMatcher

# --- I-paste mo dito yung mga TEXT lang (hindi na "[Line X | Conf: Y%]",
#     tanggalin mo yung prefix, isang linya bawat text) ---
ocr_lines = [
    "Republic of the Philippines.",
    "Pamantasan ng Cabupao",
    "UNIVERSITY OF CABUYAO)",
    "REGISTRATION FORM",
    "Name:",
    "GONZALES, MARIA MANUELA LONGASA",
    "Student No.:",
    "Bachelor of Science in Information Technology.",
    "UniFAST Grantee: Yes",
    "ocr_lines_forged"
    # idagdag mo yung iba pang lines dito
]

# --- Keywords na dapat lumabas sa authentic na PNC reg form ---
required_keywords = [
    "republic of the philippines",
    "registration form",
    "office of the university registrar",
    "university registrar",
    "unifast grantee",
]

def fuzzy_contains(full_text: str, keyword: str, threshold: float = 0.75) -> bool:
    keyword = keyword.lower()
    if keyword in full_text:
        return True
    words = full_text.split()
    kw_len = len(keyword.split())
    for i in range(len(words) - kw_len + 1):
        window = " ".join(words[i:i + kw_len])
        ratio = SequenceMatcher(None, window, keyword).ratio()
        if ratio >= threshold:
            return True
    return False

# --- Patakbuhin ang check ---
full_text = " ".join(line.lower() for line in ocr_lines)

flags = []
for kw in required_keywords:
    if not fuzzy_contains(full_text, kw):
        flags.append(f"Missing: '{kw}'")

print("=" * 40)
if flags:
    print(f"❌ NAG-FLAG NG {len(flags)} ISSUE(S):")
    for f in flags:
        print("  -", f)
else:
    print("✅ PASSED — walang flags")
print("=" * 40)