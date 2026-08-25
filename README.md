# SK Educational Assistance System (SK-EAS)

A web-based system for Barangay Mamatid's Sangguniang Kabataan (SK) Educational Assistance Program — handles student applications, document uploads, OCR-based pre-screening, verifier review, claiming-day workflows, and admin reporting.

## Tech Stack

- **Backend:** Laravel 13 (PHP 8.3), MySQL
- **Frontend:** React 18, Bootstrap
- **OCR Service:** Python/Flask microservice using PaddleOCR
- **PDF Generation:** barryvdh/laravel-dompdf

---

## Prerequisites

Before you start, make sure you have:

- **PHP 8.3+** and **Composer**
- **Node.js** (v18+) and **npm**
- **Python 3.10+** and **pip**
- **MySQL** — either a standalone MySQL Server install, or a bundled stack like **XAMPP**/**WAMP**. Instructions for both are below.
- **Git**

---

## First-Time Setup (do this once, when setting up the project fresh)

### 1. Clone the repository

```bash
git clone https://github.com/coycoyyiee143/sk-educational-assistance-system.git
cd sk-educational-assistance-system
```

### 2. Set up MySQL

You need a running MySQL server and a database created before Laravel can migrate anything. Pick whichever path matches your setup:

**If you have MySQL Server installed standalone:**
1. Make sure the MySQL service is running (check via Services on Windows, or `sudo systemctl status mysql` on Linux/Mac).
2. Create the database:
   ```bash
   mysql -u root -p
   ```
   ```sql
   CREATE DATABASE sk_eas;
   EXIT;
   ```

**If you're using XAMPP:**
1. Open the XAMPP Control Panel and click **Start** next to both **Apache** and **MySQL**.
2. Open `http://localhost/phpmyadmin` in your browser.
3. Click **New** in the left sidebar, name the database `sk_eas`, and click **Create**.
4. XAMPP's default MySQL credentials are usually `root` with **no password** — keep this in mind for step 3 below.

### 3. Backend setup (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Open `.env` and confirm these match your MySQL setup:

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=skeas_db
DB_USERNAME=root
DB_PASSWORD= # leave blank if using XAMPP's default, or set to your MySQL password


**Note on `APP_KEY`:** leave this blank — `php artisan key:generate` (already run above) fills it in automatically. Never copy a real `APP_KEY` from someone else's `.env`.

**Note on email:** this project sends real verification/notification emails via a shared Gmail account over SMTP. Ask a teammate for the Gmail address and App Password (not the actual account password), and fill them into your own local `.env` only:

MAIL_USERNAME=<the shared testing Gmail address>
MAIL_PASSWORD=<the shared App Password>

**Never commit real credentials to `.env.example` or anywhere else in the repo.**

This project also sets a longer queue retry window to accommodate PaddleOCR's processing time:

DB_QUEUE_RETRY_AFTER=300

This is already set correctly in `.env.example` — no action needed.

Also set the OCR service URL (should already be correct for local dev):
```
OCR_SERVICE_URL=http://localhost:5000
```

Then run migrations and seed the database (see [Seeders](#seeders--which-one-to-use) below to pick the right one first):

```bash
php artisan migrate:fresh --seed
```

### 4. Frontend setup (React)

```bash
cd ../frontend
npm install
```

### 5. OCR service setup (Python/Flask)

```bash
cd ../ocr-service
python -m venv venv
```

Activate the virtual environment:
- **Windows:** `venv\Scripts\activate`
- **Mac/Linux:** `source venv/bin/activate`

Then install dependencies:
```bash
pip install -r requirements.txt
```

**Note:** This file is a direct snapshot (`pip freeze`) of a working dev environment, not independently verified via a clean install. If setup fails on a specific package, `opencv-python`/`opencv-contrib-python` and `paddleocr` are the most version-sensitive — check those first.

---

## Running the System (every time you sit down to work)

You need **three services running at once**, each in its own terminal. Order doesn't matter much, but starting the queue worker and OCR service before you start uploading documents avoids confusing "stuck processing" states.

### 1. Start MySQL

- **Standalone MySQL:** confirm the service is running (it usually auto-starts with your OS).
- **XAMPP:** open the XAMPP Control Panel, click **Start** next to Apache and MySQL.

### 2. Start the Laravel backend + queue workers

```bash
cd backend
php artisan serve
```

This project uses separate queues for OCR processing and notifications, so each gets its own worker, in its own terminal:

```bash
cd backend
php artisan queue:work --queue=ocr
```

```bash
cd backend
php artisan queue:work --queue=notifications
```

> **This part matters a lot in this codebase:** queue workers only load code once, when they start. If you pull new changes or edit any file a queue touches (`ProcessOcrDocument.php` for the `ocr` queue, `ApplicationStatusNotification.php` for `notifications`), you must **stop (`Ctrl+C`) and restart the relevant worker** for the changes to actually take effect. This has caused real confusion during development — if a change "isn't working" and the code looks correct, restart the queue worker first before debugging further.

### 3. Start the OCR service (Flask)

```bash
cd ocr-service
venv\Scripts\activate      # or source venv/bin/activate on Mac/Linux
python run.py
```

> Same caution as above: even though Flask runs with `debug=True` (which usually auto-reloads on file changes), this hasn't always reliably picked up every edit during development. If an OCR-related change doesn't seem to take effect, stop (`Ctrl+C`) and restart `python run.py` before assuming the code is wrong.

### 4. Start the React frontend

```bash
cd frontend
npm start
```

The app should now be running at `http://localhost:3000`, with the API at `http://localhost:8000` and the OCR service at `http://localhost:5000`.

---

## Seeders — which one to use

`DatabaseSeeder.php` controls which seeder actually runs. Open it and comment/uncomment the line for whichever scenario you're testing, then run:

```bash
php artisan migrate:fresh --seed
```

| Seeder | Use case |
|---|---|
| **`FreshPeriodSeeder`** | Testing the **application period lifecycle** from scratch — period hasn't opened yet, no applications exist. Good for testing Admin Settings, the "Start New Application Period" flow, and open/close date enforcement. |
| **`ActivePeriodSeeder`** | Testing **specific individual flows** with a small, easy-to-reason-about dataset. Includes: an approved adult applicant ready for claiming-day testing, a registered applicant with no application yet, and a minor applicant with complete guardian info and an approved application — ready to test the guardian Voter's Certificate flow and the Verifier Review page's guardian info display without extra setup. |
| **`DemoDataSeeder`** | Testing **Reports and analytics**. Generates 3 historical application periods plus 1 active period, with realistic volume and variety — real `StudentProfile` records (minor/adult mix), `VerifierAction` records with reason categories, and `ClaimingAssignment` records with claimed/not-cleared/unclaimed outcomes. Use this whenever the Reports page needs to show actual non-empty data. Takes noticeably longer to run given the volume it generates. |

---

## Automated Testing

### Why this matters, especially for non-OCR features

Automated tests exist so that when you (or a teammate) change something, you find out **immediately** if it broke an existing feature — instead of discovering it later, by accident, possibly right before a demo. This project has already had real cases where a code change silently didn't take effect (queue worker not restarted) or where a fix was described but never actually applied to the file on disk — a test suite catches the second kind of problem instantly: if the test still fails after you think you fixed something, you know right away, rather than assuming it's fixed and finding out days later.

**Why non-OCR features specifically:** the OCR/document-verification logic (Python) depends on real, varied document images to test meaningfully — a test using a single sample image doesn't prove much about real-world accuracy, and building a proper OCR test suite requires a broader library of sample documents than this project currently has. Backend business logic (Laravel), on the other hand — status transitions, validation rules, submission gates, report calculations — doesn't depend on unpredictable real-world input, and is exactly the kind of logic where a test can definitively say "this works" or "this is broken," every time, in seconds. That's why this project's testing effort has focused there first.

### Running the existing tests

```bash
cd backend
php artisan test
```

Run a specific test file only:
```bash
php artisan test --filter=MinorGuardianVotersCertTest
```

Tests use an in-memory SQLite database, completely isolated from your real dev MySQL database — running tests never touches or deletes your actual seeded data.

### Creating a new test

```bash
php artisan make:test SomeFeatureNameTest
```

This creates `tests/Feature/SomeFeatureNameTest.php`. A test typically:
1. Creates whatever data the scenario needs (a user, an application, a config) using the model factories in `database/factories/`
2. Calls the actual API endpoint being tested, as if a real user did (`$this->actingAs($user, 'sanctum')->postJson(...)`)
3. Asserts the response and the resulting database state are what's expected

**When to write one:** any time you build or fix backend logic that has a clear right/wrong outcome — a validation rule, a status transition, a calculation, an access-control check. If you can describe the test as "given X, when Y happens, then Z should be true," it's a good candidate for an automated test rather than only manual clicking-through.

---

## Known Limitations / Open Items

- Budget forecasting currently uses a simple historical average, not statistical confidence intervals — this is a deliberate choice pending further discussion on data limitations (SK's historical records only track approved applicants, not total submissions or unmet demand).
- Report formatting has not yet been matched against any COA or DILG-required submission template — pending confirmation from SK's treasurer on whether one exists.
- No automated Python tests yet for OCR extraction logic — currently covered by manual testing against real sample documents.
- `requirements.txt` reflects a working dev environment snapshot, not an independently verified clean install.

---

## Project Structure

```
sk-educational-assistance-system/
├── backend/           # Laravel API
├── frontend/          # React app
└── ocr-service/       # Python/Flask OCR microservice
```

HERE IS DOCUMENATAION FOR FORGERY

# Forgery Detection — Blur Threshold Calibration Scripts

Standalone diagnostic scripts used to determine the sharpness threshold used in client-side upload validation (`MIN_SHARPNESS` in `ApplicantSubmission.jsx`). These are **not part of the live application** — they were run manually, once, to calibrate the threshold, and can be re-run in the future if the threshold needs to be re-validated against a larger or different sample set.

Location: `ocr-service/test_blur.py` and `ocr-service/make_blurry_test.py`

---

## Purpose

Before adding blur-detection logic to the actual applicant-facing upload form, we needed to answer one question: **does the Laplacian variance technique reliably distinguish a sharp document from a blurry one, and what threshold value should we use?**

These two scripts exist to answer that question. The number they produced (`150`) is what actually made it into production code — the scripts themselves are just the "lab equipment" used to derive it.

---

## Scripts

### `make_blurry_test.py`

Generates an artificially blurred version of an image using Gaussian blur, so we have a controlled test case to compare against a sharp original.

**Usage:**
```bash
python make_blurry_test.py <input_image_path> <output_path>
```

**Example:**
```bash
python make_blurry_test.py "samples/reg_form.png" blurred_test.png
```

The blur intensity is controlled by the `blur_radius` parameter inside the script (default `8`, which produces heavy blur). Edit this value directly in the script to test different blur intensities — e.g. `3` for a milder blur that's closer to a real out-of-focus phone photo.

### `test_blur.py`

Computes the Laplacian variance (a standard sharpness metric) of one or more images. Higher variance = sharper image. Lower variance = blurrier image.

**Usage:**
```bash
python test_blur.py <image_path_1> <image_path_2> ...
```

**Example:**
```bash
python test_blur.py "samples/reg_form.png" blurred_test.png
```

**Requires:** `scipy` (`pip install scipy` if not already installed).

---

## Calibration Results (Aug 25, 2026)

Tested against a genuine PUP Registration Form sample (`2. RF - VILLANUEVA.png`) at three sharpness levels:

| Sample | Laplacian Variance |
|---|---|
| Original (sharp) | 5,865.65 |
| Mild blur (`blur_radius=3`) | 79.14 |
| Heavy blur (`blur_radius=8`) | 3.04 |

**Chosen threshold:** `MIN_SHARPNESS = 150`

This value sits between the sharp and mild-blur cases, with margin on both sides — low enough to pass genuinely sharp photos, high enough to catch documents blurred even moderately.

---

## Known Limitations of This Calibration

- **Single-sample basis.** The threshold was derived from one document type (Registration Form). It has not yet been validated against School ID or Voter's Certification samples, which have different visual textures (more whitespace, different photo/logo placement) and may have different baseline variance even when sharp.
- **Artificial blur, not real-world blur.** Gaussian blur (used here) produces a different noise signature than genuine camera motion blur or out-of-focus shots. The threshold is a reasonable starting estimate, not a fully field-validated production value.
- **Recommended future work:** re-run this calibration against a larger set of real (not artificially blurred) sharp and blurry phone photos across all three document types, and adjust `MIN_SHARPNESS` accordingly if the distributions differ significantly from this initial test.

---

## Where the Result Is Actually Used

The derived threshold is implemented client-side in `frontend/src/pages/ApplicantSubmission.jsx`, via the `checkImageSharpness()` function — a pure JavaScript/Canvas implementation of the same Laplacian variance technique, run in-browser before a file is accepted for upload. No external library is required; it uses the HTML5 Canvas API directly.