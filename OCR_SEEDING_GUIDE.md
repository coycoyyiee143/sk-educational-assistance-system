# OCR Seeding Guide

How to seed real scanned test documents into the app so you can screenshot/review actual OCR verification results in the Verifier Review UI — without going through applicant registration, email verification, or the upload form.

This uses `backend/database/seeders/OcrTestSeeder.php`. It copies a real scanned image into storage, creates the matching `ApplicationDocument` row, then runs the real OCR job synchronously (no queue worker needed) — same as a real upload.

## School ID document-type/face-presence check: restored, bypassed only for seeded fixtures

`verify_school_id()` in `app/verification/school_id.py` calls `check_document_type()` again (restored — it was deliberately removed in commit `1e1d07a`, "fix: remove wrong_document_type auto-reupload for School ID", for producing false auto-reupload flags on genuine School IDs — unreliable text-marker matches and missing-photo detection on real ID layouts). That function (`app/upload_checks/document_type_check.py`) runs two things at once:
- the **text-marker check** (is this actually a School ID, not some other document type), and
- the **face-presence check** (`app/upload_checks/face_presence.py`'s `detect_id_photo` — does the image plausibly show a cardholder photo).

Real applicant uploads and the verifier's "Retry OCR"/"Retry All Failed OCR" buttons get this check exactly as any other upload-check gate: a failure short-circuits into an auto-reupload flag.

**`OcrTestSeeder` bypasses only this one gate for School ID**, via `ProcessOcrDocument`'s optional 4th constructor argument (`$bypassDocumentTypeCheck`, only ever passed `true` by this seeder) and the OCR service's `bypass_document_type_check` form field — real scanned test photos are framed differently than a phone-camera applicant upload and can trip the face-size heuristic on documents that are otherwise fine to seed for reviewing OTHER checks (institution/name/school-year matching, the actual focus of this seeding effort). The check still **runs** either way — a bypassed run just doesn't let it block. Its result is recorded as an ordinary `document_type_check` VerificationCheck row (label "Document Type / Photo Check" in the Verifier Review UI) instead of being silently dropped: if it would have failed, that row shows failed with a `[Seeding bypass -- would have been auto-reupload flagged]`-prefixed reason, and the Application header shows a dedicated "Would Auto-Reupload (Doc Type/Photo, Seeded)" badge (deliberately excluded from the generic "Failed Eligibility Check(s)" badge/count, same treatment as `image_integrity`/`ai_generation_provenance`).

If this check starts misfiring on GENUINE (non-seeded) uploads the same way it did before, the fix is to harden the underlying text-marker/face-detection reliability directly — not to remove the check again.

## Seeded application IDs match their case number

Each case's `applications.id` is forced to equal its seeder case number (the key in `$schools[...]['people']`, e.g. `29` for STI's Kevin James Ong Samson) instead of drifting to whatever the next auto-increment value happens to be — see the comment above `Application::forceCreate()` in `seedCase()`. This means:
- `OCR_CASE=29` and "application #29" are always the same application.
- If a verifier deletes application #29 (e.g. to force a clean re-seed after unsticking a stuck OCR job), re-running `OCR_CASE=29` recreates it at #29 again, not at some new ID.
- If #29 already exists but belongs to a different user (not this seeder's own `ocrtest29@sample.test` account), the seeder skips that case with an error instead of overwriting unrelated data — this should only happen if a real applicant account ever collides with a seeder case number, which the case-number ranges (1-20, 21-40, 41-60, 61-80, 101-120, 181-200) are deliberately spaced to avoid in a normal dev/test database.

## Seeded applicant emails

Each seeded applicant's email is `ocrtest{caseNumber}@sample.test` (e.g. `ocrtest29@sample.test` for case 29) instead of the old `ocr-sample-{school}-{number}@ocrtest.local` slug — simpler to read/type, and the number matches the case number (and therefore the application id) directly. `.test` is an IANA-reserved TLD (RFC 2606) guaranteed to never resolve or be delegated to anyone, unlike a real domain — there's no risk of ever reaching a real person's inbox if a notification email fires for one of these test accounts. `ocr:reset-samples` and `ocr:sample-summary` both match on `ocrtest%@sample.test`.

## 1. One-time setup

1. **Get the scanned test data folder** from whoever has it (currently Marc). It's a folder called `Data testing` containing one subfolder per school (`PUP`, `STI`, `SVCC`, `UPHS`, `NU`, `UP-LB`), each with `RF/`, `VC/`, and (where available) `ID/` or `SID/` subfolders.
2. **Put it at the exact path the seeder expects, OR update the seeder's path constant.** The seeder currently hardcodes:
   ```php
   private const DATA_ROOT = 'C:/Users/DELL/Documents/Data testing';
   ```
   in [OcrTestSeeder.php](backend/database/seeders/OcrTestSeeder.php). This is a machine-specific absolute path — it will NOT exist on your machine as-is. Either:
   - Put your copy of the `Data testing` folder at that exact path (adjust the drive letter/username to match your machine), **or**
   - Edit `DATA_ROOT` locally to point at wherever you put the folder (don't commit that edit unless the team agrees to change the shared default).
3. **Activate an application period.** The seeder needs an active `ApplicationConfiguration` row — seed one (e.g. `OpenApplicationPeriodSeeder`) or activate one via the admin UI first. Without this, the seeder errors out immediately.
4. **Log in with your own verifier account** (any existing one). You don't need a special account — the seeder only creates *applicant* accounts.

## 2. Running the seeder

Basic shape (PowerShell):

```powershell
$env:OCR_SCHOOL='<school folder name>'; $env:OCR_DOC_TYPE='all'; $env:OCR_BATCH_SIZE='5';
$env:OCR_BATCH='1'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='2'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='3'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='4'; php artisan db:seed --class=OcrTestSeeder
```

- `OCR_SCHOOL` — one school at a time, using the `folder` value (`PUP`, `STI`, `SVCC`, `UPHS`, `NU`, `UP-LB`), case-insensitive.
- `OCR_DOC_TYPE=all` — seeds all 3 document types per applicant (Registration Form, School ID, Voter's Certificate). Leave it unset to default to just Registration Form + Voter's Certificate.
- `OCR_BATCH_SIZE='5'` — 5 applicants per batch. Each school currently has 20 applicants, so that's 4 batches.
- `OCR_BATCH='1'..'4'` — run one batch at a time so a crash/OOM only costs you one batch, not the whole school. Bump this each command; don't re-run the same batch number twice in a row (documents already seeded are skipped automatically).

Run this **once per school**, in order:

```powershell
$env:OCR_SCHOOL='PUP'; $env:OCR_DOC_TYPE='all'; $env:OCR_BATCH_SIZE='5';
$env:OCR_BATCH='1'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='2'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='3'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='4'; php artisan db:seed --class=OcrTestSeeder

$env:OCR_SCHOOL='STI'; $env:OCR_DOC_TYPE='all'; $env:OCR_BATCH_SIZE='5';
$env:OCR_BATCH='1'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='2'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='3'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='4'; php artisan db:seed --class=OcrTestSeeder

$env:OCR_SCHOOL='SVCC'; $env:OCR_DOC_TYPE='all'; $env:OCR_BATCH_SIZE='5';
$env:OCR_BATCH='1'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='2'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='3'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='4'; php artisan db:seed --class=OcrTestSeeder

$env:OCR_SCHOOL='UPHS'; $env:OCR_DOC_TYPE='all'; $env:OCR_BATCH_SIZE='5';
$env:OCR_BATCH='1'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='2'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='3'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='4'; php artisan db:seed --class=OcrTestSeeder

$env:OCR_SCHOOL='NU'; $env:OCR_DOC_TYPE='all'; $env:OCR_BATCH_SIZE='5';
$env:OCR_BATCH='1'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='2'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='3'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='4'; php artisan db:seed --class=OcrTestSeeder

$env:OCR_SCHOOL='UP-LB'; $env:OCR_DOC_TYPE='all'; $env:OCR_BATCH_SIZE='5';
$env:OCR_BATCH='1'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='2'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='3'; php artisan db:seed --class=OcrTestSeeder
$env:OCR_BATCH='4'; php artisan db:seed --class=OcrTestSeeder
```

These are the only 6 schools we currently have real scanned data for. Do them in this order — it doesn't functionally matter, but it's convenient to review one school's results fully before moving to the next.

**If a command runs out of memory** ("Out of memory... allocated X bytes"), don't shrink the batch further — just raise the PHP memory limit for that one run:
```powershell
php -d memory_limit=512M artisan db:seed --class=OcrTestSeeder
```

**To re-seed just one person** (e.g. after fixing a bug and wanting a clean re-check), use `OCR_CASE` with their case number instead of `OCR_BATCH`:
```powershell
$env:OCR_SCHOOL='PUP'; $env:OCR_DOC_TYPE='all'; $env:OCR_CASE='6'; php artisan db:seed --class=OcrTestSeeder
```
(Case numbers are the keys in the `$schools` array in the seeder — e.g. PUP is 1-20, STI is 21-40, SVCC is 41-60, UPHS is 61-80, NU is 101-120, UP-LB is 181-200.)

## 3. Reviewing results / finding bugs

After each seed command, the console prints something like:
```
Case 'pup-006': Application #57 (Janelle Kaye Torres)
  Open /VerifierApplicationReview/57 as your verifier account to view/screenshot.
```

1. Open that URL as your verifier account.
2. Check each document's checks (identity_match, institution_match, school_year_match, template_consistency, etc.) against what the actual scan shows.
3. If a check is **wrong** (flags a genuinely correct document, or passes a genuinely wrong one), that's a bug — see below.

## 4. Debugging a bug you find

Most institution/name/school-year bugs live in `ocr-service/app/`:

- `app/extraction/school.py` — matches the header text against the declared school name (the shared logic every school goes through).
- `app/extraction/name.py` — same, for the applicant's name.
- `app/normalization/schools/*.py` — **per-school** overrides. Each school can override `preprocess_blocks()` (merge OCR lines that get split across the card/form) and `extract_school_year()` (school-specific date format). Check the file matching the school you're debugging (`pup.py`, `sti_calamba.py`, `svcc.py`, `uphsd.py`, `uplb.py`, `nu.py`).
- `app/normalization/__init__.py` — the registry mapping each declared-school dropdown string to its strategy.
- `app/verification/school_id.py`, `reg_form.py`, `voters_cert.py` — the per-document-type check orchestration (calls into the above).

**Workflow:**
1. Find/confirm the exact block of text OCR actually read (you can dump `ocr_result` or check the `raw`/`extracted` field the failing check already shows in the Verifier Review UI).
2. Fix the relevant strategy or extraction file.
3. **Write a regression test first** — there's a test for almost every fix already in `ocr-service/tests/test_school_extraction.py` and `test_school_normalization.py`; follow that pattern (construct fake `OcrBlock`s reproducing the real bad case, assert the fix).
4. Run the tests:
   ```powershell
   cd ocr-service
   python -m pytest tests/test_school_extraction.py tests/test_school_normalization.py -q
   ```
   (Skip `test_ocr_engine.py` if you don't have `paddleocr` installed locally — that's expected.)
5. Re-seed just that one case with `OCR_CASE` (see above) to confirm the fix against the real scan, not just your synthetic test.
6. Commit with a message describing the real bug you saw, not just what the code now does (see `AUTO_REUPLOAD_VERIFICATION_RULES.md` for the reasoning style this project's commit history already follows — every fix in `git log` on these files explains what real sample triggered it).

## 5. Adding a new school

When new scanned data comes in for a school we don't have yet:

1. **Data folder**: add a new subfolder under the `Data testing` root (see §1), named to match what you'll use as the `OCR_SCHOOL` filter value — e.g. `Data testing/AMA/RF/`, `Data testing/AMA/VC/`, `Data testing/AMA/ID/` (or `SID/`). Check the actual filenames you were given — the seeder assumes `RF-021.jpg` / `VC-021.jpg` / `ID-021.jpg` (zero-padded 3-digit number) by default, but folders/separators/extensions can differ per school (STI's Registration Forms are `RF - 021.png`, for example) — don't assume, look at the real filenames first.

2. **Register it in the seeder**: add a new block to the `$schools` array in [OcrTestSeeder.php](backend/database/seeders/OcrTestSeeder.php):
   ```php
   [
       'folder' => 'AMA',                          // matches Data testing/AMA
       'school' => 'AMA Computer College',          // must match the declared-school dropdown value exactly
       // Only add these if that school's filenames differ from the default:
       // 'separator' => ' ',            // default '-'
       // 'id_folder' => 'ID',           // default 'SID'
       // 'id_separator' => ' ',         // default = separator
       // 'rf_separator' => ' - ',       // RF-only override
       // 'rf_extension' => 'png',       // RF-only override, default 'jpg'
       'people' => [
           301 => 'First Middle|Middle name (optional)|Last',
           // ... pick a case-number range that doesn't collide with an existing school's range
       ],
   ],
   ```
   Ask Marc for names, or use the workbook data if it's already in the "Objective 2 — 200-Document Evaluation Workbook".

3. **Make sure the school is a valid declared-school option** — it must already exist in:
   - `frontend/src/applicant/constants/schoolsAndCourses.js` (the applicant-facing dropdown)
   - `ocr-service/config.py` (the OCR service's own known-schools list)

   If it's a genuinely new school not yet on either list, add it there too, using the exact same string in all three places (seeder, frontend dropdown, `config.py`) — a mismatch here means the seeder's `declared_school` won't line up with what OCR is checking against.

4. **Only add a dedicated strategy file if you actually need one.** Most schools work fine with zero customization (falls back to `BaseSchoolStrategy`, e.g. NU only overrides `extract_school_year`). Only add `preprocess_blocks()` logic if you find OCR is genuinely splitting the institution header or name across multiple lines/blocks and the generic matcher can't merge them — and always confirm against a real scan before writing the merge logic, not a hypothetical split. If you do add one:
   - Create `ocr-service/app/normalization/schools/<new_school>.py`, subclassing `BaseSchoolStrategy`.
   - Register it in `ocr-service/app/normalization/__init__.py`'s `SCHOOL_STRATEGY_REGISTRY`, keyed by every alias/dropdown string that school might use, all pointing at the **same strategy instance** (see the comment at the top of that file for why — two separate instances of the same school will falsely flag each other as a "different school").

5. Seed a small batch first (`OCR_BATCH_SIZE=1`) and manually check a couple of results before running the whole school, in case the folder/filename assumptions were wrong.
