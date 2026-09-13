# Auto-Reupload vs. Verifier Routing — Business Rules

This is the single source of truth for how the system decides whether a
document verification problem gets **auto-reupload** (system asks the
applicant to try again, no human involved) or **verifier routing**
(a human SK verifier has to look at it). Status: low-quality /
wrong-document-type / wrong-cert-year / **name_mismatch** are all
implemented. `institution_mismatch` (school) is blocked on missing
extraction infrastructure — see its own section below. Guardian/minor
handling is implemented (partly pre-existing, partly added alongside
name_mismatch) — see that section for what's what.

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
| Name on document confidently doesn't match applicant (label found, OCR read reliable, no match anywhere on the page) | **Auto-reupload** (`name_mismatch`) — implemented | 3 tries | Same class of mistake as wrong-document-type: most likely explanation is the applicant mistakenly uploaded someone else's or an old document |
| School/institution on document confidently doesn't match declared school | **Blocked — see Known Limitations** (`institution_mismatch`) | 3 tries (reserved, unused) | `extract_school()` has no keyword-label anchoring, so there's no way yet to distinguish a confident mismatch from "nothing matched" — see below |
| Guardian name on voter's certificate confidently doesn't match guardian on file (minor applicants only) | **Auto-reupload** (`name_mismatch`, guardian variant) — implemented | 3 tries | Same identity-mismatch logic, just checked against guardian instead of applicant |
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
| `CONFIDENT_MISMATCH_THRESHOLD` | 0.75 (reuses `CONFIDENCE_THRESHOLD`) | Name "confidently doesn't match" signal — implemented | Minimum OCR confidence on the matched label/value before a mismatch is trusted enough to auto-reupload rather than route to verifier |

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

## Cross-service config sync — deliberately NOT a shared file

An earlier version of this document proposed `shared/document_verification.json`
as a single file both Laravel and Python would read at runtime, to
prevent a category-name rename in one codebase silently going
unnoticed by the other. That was reverted. The problem it solved was
real, but the fix conflicted with the two principles above: a shared
runtime file, even with a fallback, still makes each service reach
outside itself to function — the fallback softens *how* it fails, it
doesn't remove the dependency.

**What's in place instead:** `config/document_verification.php`
(Laravel) and `NAME_MISMATCH_CATEGORY` in `shared.py` (Python) each
hardcode the category name independently, exactly as before this
document existed. This is a genuine trade-off, not a solved problem:
if someone renames `"name_mismatch"` in one file and not the other,
nothing will error — that category will just quietly stop being
capped. The mitigation is this document: renaming a category name is
a "check `AUTO_REUPLOAD_VERIFICATION_RULES.md` first" operation, not
something either codebase enforces on its own. For a single-team,
single-server capstone project, that's judged an acceptable trade for
keeping both services genuinely, unconditionally independent —
worth revisiting if this project ever grows into a larger team where
that kind of silent drift becomes more likely to actually happen.

---

## `institution_mismatch` — blocked, not built yet

Unlike name matching, `extract_school()` (`ocr-service/app/extraction/school.py`)
has **no keyword-label search at all** — no equivalent of name's
"Name:" text-anchoring. It only does positional matching (header
region, then whole-page pattern scan). When it doesn't find a match,
it always returns the same generic `method: "none"`, `confidence: 0.0`
result, regardless of whether the document confidently shows a
*different* school or simply has no readable school text at all.
There is currently no way to tell those two cases apart.

Building `institution_mismatch` on top of that today would either
silently never fire (since confidence is always 0.0 on a non-match, it
would never clear `CONFIDENT_MISMATCH_THRESHOLD`), or require guessing
at a different, unvalidated signal. Real fix: add a keyword-anchored
extraction path to `school.py` (a `"school"` entry in
`FIELD_KEYWORDS`, similar to how `"name"` works in
`keyword_engine.py`), which is new extraction work, not a
`shared.py`/routing change. `institution_mismatch` stays in
`config/document_verification.php`'s `capped_categories` list — it's
harmless to leave configured now, it simply won't be produced by
anything until this extraction work is done.

**Separate bug found and fixed while investigating this:**
`fuzzy_match_school()` (`ocr-service/app/normalization/text_utils.py`)
had a genuine false-**positive** — a bare generic institutional word
with no distinguishing suffix (e.g. OCR extracting just "Pamantasan"
with nothing else) scored a perfect 100 against "Pamantasan ng
Cabuyao" via rapidfuzz's `partial_ratio`, since it's a literal
substring. This isn't a hypothetical edge case: "Pamantasan" is shared
by several real Philippine universities (Pamantasan ng Lungsod ng
Maynila, ng Pasig, ng Cabuyao, etc.), so this could pass the
`institution_match` check for the wrong school entirely, not just fail
to flag one. A length guard already existed to prevent exactly this
(extracted text must be at least half of expected's length), but for
"Pamantasan ng Cabuyao" specifically, 10 characters is *exactly* half
of its 21-character length — not strictly less than half, so the
guard didn't trigger for this one school's name. Fixed by tightening
the guard from 0.5x to 0.75x of expected's length — verified against
the reported case, a full genuinely-wrong school name, a 1-letter OCR
typo on the correct name, and a legitimate longer official-name
variant, all behaving correctly (see `test_school_fuzzy_matching.py`).
This fix is independent of the `institution_mismatch` auto-reupload
work above — it corrects the existing `institution_match` check itself
(which still exists and still routes to verifier on failure), it just
doesn't add the new auto-reupload category.

**A second, more serious issue found and fixed while auditing the rest
of the extraction code, in two layers:**

*Layer 1 — accidental substring collisions.* `extract_barangay()`
(`ocr-service/app/extraction/barangay.py`) used bare substring checks
(`"sala" in text`) to detect both the correct barangay (Mamatid) and a
list of other real Laguna barangays, to flag a residency
"contradiction" (`SUGGESTED_DISAPPROVAL`) when a *different* barangay
is detected. `"sala"` (Brgy. Sala) is a literal substring of real
Filipino surnames — **Salazar** and **Salas** — which can appear on an
all-English COMELEC certificate as the Election Officer's printed
name, a witness's name, or the voter's own surname. Fixed with
word-boundary matching.

*Layer 2 — whole-word matches in the wrong kind of field.*
Word-boundary matching only prevents *accidental* substring collisions
— it does nothing if a barangay name is a genuine, correctly-matched
**whole word** sitting in a name or signature block rather than an
address. Concretely: if the certifying officer's actual surname simply
*is* one of these barangay names, no amount of word-boundary precision
helps, since "Salazar" containing "sala" was never the only risk —
the officer's surname coincidentally being exactly *"Pulo"* or another
full barangay name would trigger the same false flag, word boundaries
or not. This is also **systematic, not a rare coincidence**: whichever
officer is assigned to sign certificates for a given area would
trigger it on every single certificate they sign, for as long as they
hold that post.

Fixed by requiring the fallback whole-page scan (used only when no
"Barangay" label is found anywhere on the page — see below) to find a
residency-context word (`"resid"`, `"address"`, `"brgy"`,
`"barangay"`) in the same block before treating a barangay-name match
there as a contradiction. A positive "Mamatid" match is still allowed
unconditionally, since the worst case there is a missed match falling
through to manual review anyway — only the *negative*
`SUGGESTED_DISAPPROVAL` flag needed this extra guard, since that's the
direction that actively pushes a legitimate applicant's document
toward suspicion.

**Correcting the severity of this claim from an earlier version of
this document:** neither of the above causes an automatic rejection.
A contradiction flag routes to a human verifier via `eligibility_issues`,
same as any other failed check — a false positive here means wasted
verifier time and an alarming-sounding flag on a legitimate document,
not a final wrongful rejection. Still worth fixing (especially given
the "same officer, every certificate" pattern above), but it's a
workflow-efficiency and verifier-trust problem, not a due-process one.

The labeled path (`extract_via_keyword` finding an actual "Barangay:"
field) is unaffected by Layer 2 — a label match is already
inherently residency-context by construction, so it doesn't need the
same extra guard. All scenarios verified in
`test_barangay_word_boundaries.py`: the corrected Salazar/Salas
example, a genuine different-barangay mention still correctly
flagging, Mamatid and multi-word barangays still matching normally,
and both a whole-word match in a name context (now correctly NOT
flagged) and the same word in a genuine residency context (still
correctly flagged).

**Known remaining risk, not fixed here:** `"marinig"` (Brgy. Marinig)
is a common standalone Filipino word ("to hear") in its own right —
unlike "sala," this isn't a substring-truncation issue word-boundary
matching can fix, since "marinig" would appear as a genuine whole word
in unrelated document text too (e.g. inside a notarization clause). A
document containing this word anywhere for unrelated reasons could
still trigger a false contradiction. Flagging this rather than
silently leaving it undocumented — a real fix would need something
more structural (e.g. only trusting a barangay match when it appears
near an address-context anchor), which is a larger change than this
pass covers.

**School ID name-matching caveat (separate from the above):** even for
`name_mismatch`, school IDs are less reliable than reg forms or voter's
certificates for the same underlying reason — many ID layouts print
the name with no "Name:" label at all, just raw text near a photo.
When there's no label, `label_anchored_no_match` never fires, so it
correctly falls through to the ambiguous/verifier-routed case instead
of firing incorrectly. This isn't a bug — it's the safe default — but
it does mean `name_mismatch` will trigger less often on school IDs
than on the other two document types in practice.

---