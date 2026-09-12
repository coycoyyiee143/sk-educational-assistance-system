# Auto-Reupload vs. Verifier Routing — Business Rules

This is the single source of truth for how the system decides whether a
document verification problem gets **auto-reupload** (system asks the
applicant to try again, no human involved) or **verifier routing**
(a human SK verifier has to look at it). Status: **design finalized,
partially implemented** — the low-quality / wrong-document-type /
wrong-cert-year paths already exist in code; name/school mismatch and
the guardian/minor fixes below are the planned extension.

If a defense panel asks "why doesn't the system just reject automatically"
or "why does a human have to look at this one," the answer is always one
of the two principles below.

---

## The core principle

**Auto-reupload is only valid when ALL three are true:**
1. The system is confident (low false-positive risk).
2. The most likely cause is an honest mistake by the applicant —
   something fixable by trying again.
3. No fraud or eligibility judgment is involved — it's a mechanical
   "wrong file," not a "you don't qualify."

**Verifier routing is required when ANY of these is true:**
1. The signal could indicate something intentional (forgery,
   AI-generation, tampering, inconsistent layout). Auto-reupload here
   would just give a bad actor another attempt at submitting a better
   fake — the correct response is reject/investigate, not "try again."
2. It's a substantive eligibility judgment (not actually a Mamatid
   resident, minor with no guardian on file). Reuploading the exact
   same document doesn't change the answer — a human has to decide.
3. Confidence is genuinely ambiguous (borderline similarity score,
   weak OCR on an otherwise-fine document). The match could be
   correct with a bad read; auto-rejecting risks punishing a
   legitimate applicant.

---

## Routing table

| Check | Route | Cap | Why |
|---|---|---|---|
| Image blurry / low document-level OCR confidence | **Auto-reupload** (`low_quality`) | Uncapped | Purely mechanical — a bad scan isn't evidence the applicant can't fix, so it never counts against them long-term |
| Wrong document type uploaded (e.g. school ID submitted where a reg form was expected) | **Auto-reupload** (`wrong_document_type`) | 3 tries | Clear-cut, unambiguous — the system can tell what kind of document it's looking at reliably |
| Cert year wrong, **high OCR confidence only** (≥0.9) | **Auto-reupload** (`wrong_cert_year`) | 3 tries | Only short-circuits when the read is confident; a low-confidence or not-found year falls through to the ambiguous case below instead |
| Name on document confidently doesn't match applicant (label found, OCR read reliable, no match anywhere on the page) | **Auto-reupload** (`name_mismatch`) — *planned* | 3 tries | Same class of mistake as wrong-document-type: most likely explanation is the applicant mistakenly uploaded someone else's or an old document |
| School/institution on document confidently doesn't match declared school | **Auto-reupload** (`institution_mismatch`) — *planned* | 3 tries | Same reasoning as name mismatch |
| Guardian name on voter's certificate confidently doesn't match guardian on file (minor applicants only) | **Auto-reupload** (`name_mismatch`, guardian variant) — *planned* | 3 tries | Same identity-mismatch logic, just checked against guardian instead of applicant |
| Name/school/guardian-name match is ambiguous — no label found at all, OR OCR confidence on the label/value is weak, OR similarity score is borderline | **Verifier** | Uncapped | Genuinely unsure whether it's a real mismatch or just a bad scan of the right document — a human has to make the call |
| School year / cert year low-confidence or not-found | **Verifier** (existing design) | Uncapped | Documented in code as watermark-interference-prone and format-variant-heavy — deliberately kept manual even before this round of changes |
| Residency (barangay ≠ Mamatid) | **Verifier — always** | N/A | This *is* the eligibility determination itself, not a wrong upload |
| Minor applicant, no guardian info on file, still reaching OCR stage | **Verifier — always** (edge case only, see Guardian/Minor section) | N/A | Data gap on the applicant's profile, not a document problem — reuploading the same file cannot fix it |
| Template/layout inconsistency | **Verifier — always** | N/A | Inconsistent layout is a possible tampering signal, not just "wrong file" |
| Image integrity (ELA / forgery check) | **Verifier — always** | N/A | Forgery signal — this exists specifically to catch things that should be rejected, not retried |
| Document origin (PDF metadata) | **Verifier — always** | N/A | Authenticity signal, same reasoning as above |
| AI-generation provenance | **Verifier — always** | N/A | Detects AI-generated documents — a reject candidate, never a "try again" candidate |

**3-try cap, shared logic:** `wrong_document_type`, `wrong_cert_year`,
`name_mismatch`, and `institution_mismatch` all share the same retry
cap. On the 4th flagged attempt for the *same category on the same
document type*, the system stops auto-reuploading and escalates
straight to the verifier with the full history of prior attempts
attached — at that point repeated identical mistakes are more likely
a rejection candidate than an honest slip. `low_quality` is
deliberately excluded from the cap: a scan that keeps coming out
blurry isn't something the applicant can necessarily fix faster by
retrying, so it doesn't count against them.

---

## Thresholds

These are the actual numeric cutoffs the system uses to decide
"confident" vs. "ambiguous." Where a threshold already existed in code
before this round of changes, it's kept as-is — no reason to change a
number that was already reasoned through.

| Constant | Value | Applies to | Meaning |
|---|---|---|---|
| `CONFIDENCE_THRESHOLD` | 0.75 | Whole-document average OCR confidence | Below this, the scan is treated as unreliable → `low_quality` auto-reupload, before any field is even checked |
| Text-similarity pass gate | 85 (out of 100) | Name & school fuzzy matching | Minimum text-similarity score before a name/school is even considered "matching" — tolerates a 1-letter OCR typo, not a genuinely different name |
| `NAME_SCHOOL_CONFIDENCE_FLOOR` | 0.65 | Name & school checks specifically | See note below — this is a blended score, not raw OCR confidence |
| `RAW_FIELD_CONFIDENCE_FLOOR` | 0.5 | School year, cert year, barangay | Raw OCR confidence floor for fields that don't use similarity blending |
| Cert-year mismatch confidence gate | 0.9 | Cert year auto-reupload specifically | Only short-circuits to auto-reupload when OCR is very sure; anything less falls through to manual review |
| **Confident-mismatch threshold (new)** | **0.75** *(proposed, reuses `CONFIDENCE_THRESHOLD`)* | Name/school "confidently doesn't match" signal | Minimum OCR confidence on the matched label/value before a mismatch is trusted enough to auto-reupload rather than route to verifier |

**Why 0.65 for `NAME_SCHOOL_CONFIDENCE_FLOOR` specifically:** name and
school checks don't use raw OCR confidence directly — they blend OCR
confidence (40% weight) with the text-similarity score (60% weight),
and that blend only runs *after* similarity has already cleared 85.
That creates a built-in floor: even with OCR confidence of 0, the
blended score is still `0.6 × 0.85 = 0.51`. A threshold near 0.5 would
almost never fire, since everything already clears it by construction.
0.65 sits meaningfully above that floor — solving backward, it
requires roughly ≥35% raw OCR confidence (at the minimum passing
similarity) before the match is trusted outright. Below that, the text
technically matched but the read itself was weak, so it's routed to a
verifier instead of auto-passed.

**Why the confident-mismatch threshold reuses 0.75 instead of a new
number:** that's already the bar the system uses elsewhere to decide
"this OCR read is reliable enough to act on automatically"
(`CONFIDENCE_THRESHOLD`). Reusing it keeps the system's definition of
"confident" consistent in one place rather than introducing a second,
arbitrary cutoff with no independent justification.

---

## Guardian / minor handling

Two of the concerns here turned out to already be solved before this
round of design work — worth stating plainly so nobody re-does them,
and so a defense panel checking the repo sees documentation that
matches reality:

1. **`is_minor` is already computed dynamically, not stored.**
   `StudentProfile::getIsMinorAttribute()` calculates age from
   `birthdate` every time it's read (`$this->birthdate->age < 18`) —
   it is not a fixed flag written once. An applicant who was a minor
   last cycle correctly evaluates to an adult once they turn 18,
   automatically, with no manual update needed. **Already implemented
   — not new work.**

2. **Missing guardian info is already blocked at submission time,
   not discovered later via OCR.** The application-submission endpoint
   already rejects (HTTP 400) a minor applicant who hasn't completed
   guardian info on their profile, before they can upload any
   documents at all (`MinorGuardianVotersCertTest::test_application_
   blocked_when_minor_without_guardian_info`). This removes almost
   all cases of this reaching a verifier. **Already implemented — not
   new work.**

3. **Guardian name-on-document check uses the same 3-tier framework
   as applicant name matching — this IS new/planned work.** The
   voter's certificate for a minor applicant is checked against the
   guardian's name (since the minor can't be a registered voter
   themselves, the guardian's certificate stands in for residency
   proof): confident match → pass, confident mismatch → auto-reupload
   (3-try cap, same as `name_mismatch`), ambiguous/weak OCR → verifier.
   This reuses the same `_check_name` mechanism already in the OCR
   service, just needs the confident-mismatch tier (see thresholds
   section) applied to it the same way it's applied to the applicant
   name check.

4. **Remaining edge case:** if missing guardian info somehow still
   reaches the OCR stage despite #2 (e.g. profile was edited between
   submission and processing), it routes to verifier — never
   auto-reupload. There is no "wrong file" to swap; the gap is missing
   data on the applicant's account, not a bad document.

---

## Known limitation — not yet solved

The auto-reupload thresholds live in the Python OCR microservice
(`ocr-service/app/verification/shared.py`), while the retry-cap
categories and escalation logic live in the Laravel backend
(`ProcessOcrDocument.php`). There's no single config file both
services read — they're two separate codebases. This document is
the closest thing to a shared source of truth until/unless a real
shared config format is introduced between the two services. On the
Laravel side specifically, the capped-categories list and max-attempt
count are being pulled out of the hardcoded array into
`config/document_verification.php` (see accompanying file) so at
least that half is centralized and referenced from one place instead
of hardcoded inline.