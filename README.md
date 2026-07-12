# SK-EAS — Setup & Testing Guide

Web-Based Sangguniang Kabataan Educational Assistance System with Optical Character Recognition Rule-Based Automated Verification.

This guide covers how to set up the project locally and how to test the current features, including the **Claiming Schedule**, **Announcements/Events**, and **Admin Reports** modules.

---

## 1. Tech Stack

| Component | Tech | Port |
|---|---|---|
| Frontend | React 18 (Create React App) + Bootstrap 5 | 3000 |
| Backend  | Laravel 13 REST API | 8000 |
| OCR Service | Python 3.10 + Flask + PaddleOCR 2.7.3 | 5000 |
| Database | MySQL 8.0 | 3306 |

---

## 2. Prerequisites

Install these before starting:

- **PHP 8.2+** and **Composer**
- **Node.js 18+** and **npm**
- **Python 3.10** (must be 3.10 specifically — newer versions break PaddleOCR on Windows)
- **MySQL 8.0** (e.g. via XAMPP/Laragon, or standalone)
- **Git**

---

## 3. Clone the Repo

```bash
git clone https://github.com/coycoyyiee143/sk-educational-assistance-system.git
cd sk-educational-assistance-system
git checkout feature/backend
git pull
```

Project structure:
```
sk-educational-assistance-system/
├── backend/        # Laravel 13 API
├── frontend/       # React 18 (CRA)
├── ocr-service/    # Flask + PaddleOCR
```

---

## 4. Database Setup

Open MySQL and create the database:
```sql
CREATE DATABASE skeas_db;
```

Username/password defaults to `root` / your local MySQL password — this is configured in `backend/.env` (see next step).

---

## 5. Backend Setup (Laravel)

```bash
cd backend
composer install
```

### 5.1 Create `.env`

Copy `.env.example` to `.env` (or create `.env` with the contents below), then update `DB_PASSWORD` to match your local MySQL setup:

```env
APP_NAME=Laravel
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost
APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

LOG_CHANNEL=stack
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=skeas_db
DB_USERNAME=root
DB_PASSWORD=your_mysql_password_here

# Prevents PaddleOCR job timeouts
DB_QUEUE_RETRY_AFTER=300

SESSION_DRIVER=database
SESSION_LIFETIME=120

QUEUE_CONNECTION=database
CACHE_STORE=file

MAIL_MAILER=log
MAIL_FROM_ADDRESS="no-reply@example.com"
MAIL_FROM_NAME="Mamatid SK Educational Assistance System"

FRONTEND_URL=http://localhost:3000
OCR_SERVICE_URL=http://localhost:5000
```

> **Note on emails:** `MAIL_MAILER=log` means emails are NOT actually sent — they're written to `backend/storage/logs/laravel.log`. Open this file and search for the email content (verification links, status updates, claiming schedule notices, etc.) to view emails during testing.

### 5.2 Generate app key, migrate, and seed

```bash
php artisan key:generate
php artisan migrate:fresh --seed
php artisan storage:link
```

This creates a clean database with:
- An SK Admin account
- An SK Verifier account
- An active application period

See section 9 for the seeded login credentials.

### 5.3 Run the backend (you need 2 terminals)

**Terminal 1 — API server:**
```bash
php artisan serve
```

**Terminal 2 — Queue worker (REQUIRED for OCR processing & emails to process):**
```bash
php artisan queue:work
```

> 💡 **Routing Check:** If you need to verify the exact URL mappings for the new Announcements, Events, or Admin Report endpoints, run `php artisan route:list --path=api` inside the backend directory.

> ⚠️ Document uploads and email notifications are processed via Laravel's database queue. If `queue:work` is not running, uploaded documents will stay stuck on "pending" forever and emails won't write to the log.

---

## 6. OCR Service Setup (Flask + PaddleOCR)

```bash
cd ocr-service
python -m venv venv
```

**Activate venv:**
- Windows: `venv\Scripts\activate`
- Mac/Linux: `source venv/bin/activate`

**Install dependencies:**
```bash
pip install -r requirements.txt
```

If `requirements.txt` doesn't pin versions correctly, the critical ones are:
```bash
pip install paddlepaddle==2.6.2
pip install paddleocr==2.7.3
pip install flask flask-cors
```

> ⚠️ **Do not upgrade PaddleOCR/paddlepaddle versions.** The pipeline is built against 2.7.3 / 2.6.2 specifically — newer versions (including 2.8.x and 3.x) have API differences or Windows/oneDNN incompatibilities that will silently break OCR extraction.

**Run the OCR service:**
```bash
python run.py
```
(or `flask run --port=5000` depending on the entry point — check the existing `app/` folder structure)

The OCR service should be running on `http://localhost:5000`. Test it's alive:
```bash
curl http://localhost:5000/api/ocr/health
```
Should return `{"status": "ok"}`.

---

## 7. Frontend Setup (React)

```bash
cd frontend
npm install
npm start
```

This runs on `http://localhost:3000` and should open automatically in your browser.

---

## 8. Running Everything Together

You need **4 terminals** running simultaneously:

| Terminal | Command | Directory |
|---|---|---|
| 1 | `php artisan serve` | `backend/` |
| 2 | `php artisan queue:work` | `backend/` |
| 3 | `python run.py` | `ocr-service/` (venv activated) |
| 4 | `npm start` | `frontend/` |

---

## 9. Test Accounts

These are created automatically by the seeder:

| Role | Email | Password |
|---|---|---|
| SK Admin | admin@skmamatid.com | admin123 |
| SK Verifier | verifier@skmamatid.com | verifier123 |

**Applicant accounts are not seeded** — register your own at `/register`. This is intentional so the registration and email verification flow can be tested properly (see section 10).

---

## 10. Testing the Core Application Flow

1. **Register** a new applicant account at `/register`
2. Check `backend/storage/logs/laravel.log` for the email verification link (search for "Verify Your Educational Assistance Account")
3. Copy the link and open it in your browser (it'll be `http://localhost:3000/verify-email/...`)
4. **Login** as the applicant
5. Complete your profile, then go to **Application Submission**
6. Fill out the form and upload 3 documents:
   - Registration Form / Certificate of Enrollment
   - School ID
   - Voter's Certificate
7. Wait a few seconds — the queue worker will process OCR for each document
8. Check **Application Status** page — it should update automatically based on OCR results:
   - All checks pass → `approved` (auto-approved, control number assigned like `SK-2026-0001`)
   - Any check fails / low confidence → `for_review`
9. **Login as verifier** (`verifier@skmamatid.com`)
10. Go to **Verifier Dashboard / Application List** → review flagged applications
11. Approve / Reject / Request Re-upload — check `laravel.log` for the corresponding notification email
12. If re-upload was requested, log back in as the applicant and check **Application Submission** — it should show which documents need re-uploading and why

---

## 11. Testing the Claiming Schedule Feature

This is a recently added feature and has not been tested end-to-end yet.

### Step 1 — Get applicants to "approved" status with control numbers
You need at least 1-2 applications with status `approved` and a `control_number` like `SK-2026-0001`. Use the flow above (submit → auto-approve or verifier-approve) to get a few approved applicants.

> Control numbers are sequential per application period (`SK-2026-0001`, `SK-2026-0002`, ...). Lanes are matched against this numeric portion, so make sure your test applicants' control numbers fall within the lane ranges you configure below.

### Step 2 — Admin sets up the Claiming Schedule
1. Login as `admin@skmamatid.com`
2. Go to **Claiming Schedule** (AdminSchedule page)
3. You should see "X approved applicants found" if there are approved applications
4. Fill in:
   - Claiming location
   - Morning/afternoon batch times
   - Grace period date
   - At least one **Lane** with a control number range that covers your approved applicants' numbers (e.g. Lane 1: `0001` to `0100`)
5. Click **Save Schedule**
6. Click **Publish Schedule**
   - This assigns each approved applicant to a lane based on their control number
   - Each assigned applicant should receive a "Your Claiming Schedule Has Been Released" email — check `laravel.log`
   - Once published, the schedule can no longer be edited

### Step 3 — Applicant views their claiming schedule
1. Login as the applicant whose application was approved
2. Go to **Claiming Schedule** page (ApplicantClaimingSchedule)
3. Should show: assigned lane, date, time (morning/afternoon), venue, control number

### Step 4 — Verifier processes claiming day
1. Login as `verifier@skmamatid.com`
2. Go to **Claiming** page (VerifierClaiming)
3. Search by control number (e.g. `SK-2026-0001`) or applicant name
4. Applicant details, lane assignment, and uploaded documents should appear
5. Check the physical document checkboxes
6. Add optional notes
7. Click **Mark as Claimed** / **Not Cleared** / **Unclaimed**
8. Applicant should receive a corresponding status email — check `laravel.log`
9. Login as the applicant and confirm **Application Status** page reflects the new status (`claimed`, `not_cleared`, or `unclaimed`)

### Step 5 — (Optional) Test the claiming reminder
The reminder normally runs daily via the scheduler, but you can trigger it manually:
```bash
cd backend
php artisan claiming:send-reminders
```
This sends a reminder email to anyone whose `claiming_date` is **tomorrow** and whose claim status is still `pending`. You may need to manually adjust a lane's `claiming_date` in the database to "tomorrow" to test this, since the schedule dates are set by the admin form.

---

## 12. Testing Announcements, Events, and Admin Reports

This is the most recently added feature and has not been tested end-to-end yet.

### Step 1 — Announcements & Events CRUD
1. Login as `admin@skmamatid.com`
2. Go to **Announcements** or **Events** management views (`AdminAnnouncements.jsx` / `AdminEvents.jsx`).
3. Create new records, edit existing ones, or delete test content.
   - For **Events**: Upload a feature cover image file. The display state indicator is auto-calculated dynamically from the `event_date` instead of setting it manually.
4. Open the public `/announcements` and `/events` routing pages on the frontend. Newly configured entries will show up there automatically because `is_published` resolves to true on creation.

> ⚠️ **Image Upload Prerequisite:** Ensure `php artisan storage:link` was successfully run during setup so local storage links like `http://localhost:8000/storage/events/...` can resolve asset files correctly in the client view.

### Step 2 — Live Summaries & Budget Forecasting
1. Go to the **Admin Reports** page (`AdminReports.jsx`).
2. Verify the system lists running aggregate metric summaries (Total Applicants, Pending, Approved, Rejection rates, etc.).
3. Look at the **Budget Forecast** metrics block. 

> **Note on Forecasting Behavior:** If your installation only contains a single active configuration period with no historical records marked complete (`is_active = false`), the calculator algorithm defaults to compiling projections against your active session's running dataset. To simulate complete multi-period analytical variations, use `php artisan tinker` to seed an alternate inactive `ApplicationConfiguration` containing a collection of sample records under its relation block.

### Step 3 — CSV Export Data Verification
1. From the reports viewer panel, click **Export CSV**.
2. Save the output string file, then view its records inside an editor like Microsoft Excel or Google Sheets.
3. Validate row parameters match the default database entry maps (IDs, Control Numbers, Course parameters, Timestamps, and Status strings).

---

## 13. Notes When Testing

When testing, keep an eye on:
- Any error messages shown on screen (screenshot if possible)
- Any blank/broken pages
- Whether emails appear correctly in `laravel.log` (subject, content, links)
- Whether status changes reflect correctly across applicant/verifier/admin views
- Anything that doesn't match the expected flow described above

If something breaks, check (in this order):
1. Browser console (F12 → Console tab) for frontend errors
2. `backend/storage/logs/laravel.log` for backend errors
3. The terminal running `queue:work` for OCR job errors
4. The terminal running the Flask OCR service for Python errors

---

## 14. Common Issues

| Problem | Fix |
|---|---|
| Documents stuck on "pending" forever | Make sure `php artisan queue:work` is running |
| OCR fails / 500 error on upload | Make sure Flask service (`python run.py`) is running on port 5000 |
| "Route [login] not defined" error | Already fixed in `bootstrap/app.php`, make sure you pulled latest |
| File upload returns 422 error | Don't manually set `Content-Type` header for FormData requests |
| Login says invalid credentials but you're sure it's right | Re-run `php artisan migrate:fresh --seed` for a clean DB |
| CORS error in browser console | Make sure frontend runs on port 3000 (not 5173) — backend CORS only allows `localhost:3000` |
| Broken event image links or 404 errors | Ensure `php artisan storage:link` ran successfully and check your backend `.env` `APP_URL` match |
| Report/Forecast statistics look inaccurate or stale | Re-run `php artisan migrate:fresh --seed` to reset live benchmark tallies |

---

## 15. Branch & Commit Etiquette

- Current working branch: `feature/backend`
- Pull before you start: `git pull`
- Commit with clear messages describing what you changed/fixed
- If you find bugs you can't fix, document them with screenshots + steps to reproduce so they can be tracked