# SK-EAS — Setup & Testing Guide

Web-Based Sangguniang Kabataan Educational Assistance System with Optical Character Recognition Rule-Based Automated Verification.

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
sk-educational-assistance-system/
├── backend/ # Laravel 13 API
├── frontend/ # React 18 (CRA)
├── ocr-service/ # Flask + PaddleOCR

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

Copy `.env.example` to `.env` (or create `.env` with the contents below), then update the values in brackets to match your local setup:

```env
APP_NAME="Mamatid SK Educational Assistance Program System"
APP_ENV=local
APP_KEY=[generate with php artisan key:generate]
APP_DEBUG=true
APP_URL=http://localhost

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=skeas_db
DB_USERNAME=root
DB_PASSWORD=[your local MySQL password]

# Prevents PaddleOCR job timeouts
DB_QUEUE_RETRY_AFTER=300

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database

CACHE_STORE=file

MEMCACHED_HOST=127.0.0.1

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

# Emails are sent via real SMTP now (not logged to file).
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME="[your gmail address]"
MAIL_PASSWORD=[gmail app password]
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="no-reply@skeas-mamatid.com"
MAIL_FROM_NAME="Mamatid SK Educational Assistance System"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

FRONTEND_URL=http://localhost:3000

OCR_SERVICE_URL=http://localhost:5000
```

> **Note on emails:** Since `MAIL_MAILER=smtp`, emails are sent for real through Gmail's SMTP server. You'll need a [Gmail App Password](https://myaccount.google.com/apppasswords) (not your regular password) for `MAIL_PASSWORD` — regular Gmail passwords won't work with SMTP auth.
>
> **Note on file storage:** `FILESYSTEM_DISK=local` — uploaded documents are stored privately and served only through authenticated routes, not the public disk. Don't switch this back to `public`.

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

### 5.3 Run the backend (you need 3 terminals)

**Terminal 1 — API server:**
```bash
php artisan serve
```

**Terminal 2 — OCR queue worker (REQUIRED for document processing):**
```bash
php artisan queue:work --queue=ocr
```

**Terminal 3 — Notifications queue worker (REQUIRED for emails):**
```bash
php artisan queue:work --queue=notifications
```

> **Why two queue workers?** OCR jobs and notification emails now run on separate queues so a slow OCR call (up to ~180s per document) doesn't block email delivery, and vice versa. Both workers need to be running — if either one isn't, jobs on that queue will pile up and never process. `php artisan queue:work` with no `--queue` flag only listens to the default queue and will process nothing.

> 💡 **Routing Check:** If you need to verify the exact URL mappings for any endpoint, run `php artisan route:list --path=api` inside the backend directory.

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

You need **5 terminals** running simultaneously:

| Terminal | Command | Directory |
|---|---|---|
| 1 | `php artisan serve` | `backend/` |
| 2 | `php artisan queue:work --queue=ocr` | `backend/` |
| 3 | `php artisan queue:work --queue=notifications` | `backend/` |
| 4 | `python run.py` | `ocr-service/` (venv activated) |
| 5 | `npm start` | `frontend/` |

---

## 9. Test Accounts

These are created automatically by the seeder:

| Role | Email | Password |
|---|---|---|
| SK Admin | admin@skmamatid.com | admin123 |
| SK Verifier | verifier@skmamatid.com | verifier123 |

Register your own applicant accounts at `/register`.

---

## 10. Branch & Commit Etiquette

- Current working branch: `feature/backend`
- Pull before you start: `git pull`
- Commit with clear messages describing what you changed/fixed
- If you find bugs you can't fix, document them with screenshots + steps to reproduce so they can be tracked