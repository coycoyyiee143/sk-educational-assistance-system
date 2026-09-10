# Security Branch Documentation — feature/password-otp-security

Reference doc for everything added/changed in this branch. Written for
future-you (or teammates) picking this back up later.

---

## What this branch adds

1. **Password policy**: 8 char min, must have lowercase + a number,
   checked against the Have I Been Pwned breach corpus, blocked against
   a small denylist of obvious/context-specific weak terms (admin,
   password, etc.), can't reuse any of your last 5 passwords, no forced
   expiry.
2. **Login lockout**: 5 failed password attempts locks the account for
   15 minutes.
3. **Two-factor authentication (TOTP)**: required every login, via an
   authenticator app (Google Authenticator, Authy, etc.) — not email OTP.
   First login ever triggers a QR-code enrollment screen; every login
   after that prompts for a 6-digit code.
4. **Clearer validation errors**: multiple failed password rules now
   render as a bulleted list in the UI instead of one run-on sentence.

---

## Why these specific choices (in case someone asks "why not X")

- **TOTP authenticator app, not email OTP.** NIST SP 800-63B-4 (the
  current federal digital identity standard, finalized July 2025)
  explicitly does not recognize email as a valid authentication channel
  — an authenticator app is a real, standards-recognized second factor;
  email OTP is not, even though it's still useful as an extra layer.
- **8 char minimum, not 12+.** NIST allows 8 chars when paired with a
  real second factor (which the TOTP app provides). Length requirements
  jump to 15 only when a password is the *sole* factor.
- **No composition rules beyond lowercase+number.** NIST actively
  discourages forced uppercase/symbol requirements — they push users
  toward predictable patterns (`Password1!`) without meaningfully
  improving security. Breach-checking + reuse-blocking do more real
  work than composition rules.
- **No forced password expiry.** Also a NIST recommendation — forced
  rotation tends to make people choose *weaker* passwords or increment
  a number, not stronger ones, absent evidence of an actual compromise.
- **`NotObviouslyWeakPassword` is a minor layer, not a headline
  feature.** The HIBP breach-check only flags passwords that have
  actually appeared in a real leaked-credential dump — it's not a
  general weakness heuristic. Something like `admin123` can slip
  through if it's never been recorded in that specific corpus, even
  though it's an obviously bad password. This rule is a small,
  cheap denylist on top of the real breach-check — it closes one
  narrow gap, it is **not** what makes the system hard to break into.
  The actual security weight is carried by TOTP 2FA (biggest factor),
  login lockout, and the breach-check itself — don't oversell this
  one rule in a thesis defense or documentation as a major feature.

---

## File map

### Backend (`backend/`)

| File | Purpose |
|---|---|
| `database/migrations/2026_09_10_171616_add_password_and_otp_security_to_users_table.php` | Adds `google2fa_secret`, `google2fa_enabled_at`, `failed_login_attempts`, `locked_until` to `users`; creates `password_histories` table |
| `app/Models/PasswordHistory.php` | One row per password ever set, per user |
| `app/Rules/NotRecentlyUsedPassword.php` | Blocks reuse of last N passwords (currently 5). Gives a distinct message when the attempted password is the *current* one vs. an older one in history. |
| `app/Rules/NotObviouslyWeakPassword.php` | Blocks a small denylist of obvious/context-specific terms the HIBP breach corpus doesn't reliably catch (e.g. "admin123") |
| `app/Services/TwoFactorService.php` | Wraps `pragmarx/google2fa` — secret generation, QR URL, code verification |
| `app/Http/Controllers/Api/AuthController.php` | `login()` now lockout-checks, then branches into 2FA setup or verify instead of returning a token directly. `confirmTwoFactorSetup()` / `verifyTwoFactor()` are the two ways a real Sanctum token finally gets issued. `passwordRules()` is the shared static rule set used at registration, now including `NotObviouslyWeakPassword`. |
| `app/Http/Controllers/Api/ProfileController.php` | `updatePassword()` — self-service password change, enforces full policy incl. reuse and the weak-term denylist |
| `app/Http/Controllers/Api/AdminController.php` | `createPersonnel()` / `updateUser()` — same full password policy applied to admin-created verifier/admin accounts |
| `app/Providers/AppServiceProvider.php` | Forces `https://` on generated URLs (`route()`/`url()`) when `APP_URL` is https — fixes mixed-content blocking behind a reverse proxy |
| `routes/api.php` | `/2fa/setup/confirm` and `/2fa/verify` routes, both handled by `AuthController` (no separate `TwoFactorController`) |

**Note on scope:** verifier and applicant password changes both go
through the same shared `PUT /user/password` → `ProfileController::
updatePassword()` route — there's no separate `VerifierController`/
`ApplicantController` password logic to duplicate this into.

### Frontend (`frontend/`)

| File | Purpose |
|---|---|
| `src/services/api.js` | Exports `STORAGE_URL` (single source of truth, used to build image URLs) alongside the axios instance. `baseURL` reads `REACT_APP_API_URL`. |
| `src/context/AuthContext.js` | Guards against saving incomplete login data; recovers gracefully from corrupted `localStorage` instead of crashing the whole app |
| `src/public/pages/Login.jsx` | Three-step flow: credentials → (first login only) QR setup screen → code verification. QR rendered client-side via `qrcode.react`, never sent to a third-party image service. |
| `src/public/pages/Register.jsx`, `*ChangePasswordModal.jsx` (admin/applicant/verifier) | UI checklist updated to match backend policy (lowercase + number, no forced uppercase) |
| `*ChangePasswordModal.jsx` (admin/applicant/verifier) | Validation errors now render as a bulleted list (`• message`) when more than one rule fails, instead of every message crammed into one run-on sentence |
| `src/admin/pages/AdminEvents.jsx`, `src/public/pages/Events.jsx` | Import `STORAGE_URL` from `api.js` instead of each computing their own (previously inconsistent) fallback |
| `.env.development` | `REACT_APP_API_URL=http://localhost:8000/api` — committed so every teammate gets working local dev out of the box |

---

## Setup commands (fresh clone / after pulling this branch)

```bash
# Backend
cd backend
composer install
php artisan migrate
php artisan config:clear

# Frontend
cd frontend
npm install
```

`.env.development` is already committed — no manual `.env` setup needed
for local dev API URL. `.env.production` (also committed) handles the
deployed site.

**Windows-only extra step:** if password-policy testing shows breached
passwords going through unblocked, your local PHP almost certainly has
no CA certificate bundle configured for outbound HTTPS (this bit us
once already — see gotchas below). Linux servers usually don't need
this fix.

---

## Known gotchas (things that already bit us once)

- **Composer install timeouts**: if `composer require` hangs on a
  connection timeout, it's usually transient — retry, or run
  `composer diagnose` to see exactly what's unreachable.
- **Migration re-run duplicate-column errors**: if a migration partially
  ran before (columns got created but Laravel didn't mark it "Ran" due
  to an unrelated failure), re-running throws "column already exists."
  Fix: manually insert a row into the `migrations` table marking it
  done, matching the current highest `batch` number — don't try to
  re-run the `up()` method again once columns already exist.
- **Mixed content blocking images on the live server**: caused by
  Laravel generating `http://` links even though the site is served
  over `https://`, because Nginx terminates SSL and forwards to
  PHP-FPM over plain HTTP internally. Fixed via `URL::forceScheme()`
  in `AppServiceProvider` — but if this resurfaces after infra changes,
  check that fix is still in place.
- **`APP_ENV=local` / `APP_DEBUG=true` on the live server**: security
  risk (exposes stack traces, file paths, possibly `.env` values to
  any visitor who triggers an error). Should always be
  `APP_ENV=production` / `APP_DEBUG=false` in production.
- **Local `APP_URL` needs the port**: `http://localhost` without
  `:8000` causes generated URLs (like the face-verification photo
  endpoint) to point at the wrong place, which manifests as an
  infinite loading spinner rather than a clean error.
- **Systemd service names on the production server**: `sk-eas-backend`,
  `sk-eas-queue-notifications`, `sk-eas-queue-ocr`. Restart all three
  after any backend code change — `sudo systemctl restart <name>`.
  Queue workers especially: they keep old code loaded in memory until
  restarted, even after `git pull`.
- **HIBP breach-check (`->uncompromised()`) only catches passwords that
  appear in real leaked-credential dumps** — not a general weakness
  heuristic. Obvious test/placeholder passwords like `admin123` can
  slip through if they've never actually shown up in a tracked breach.
  That's what `NotObviouslyWeakPassword` is for — a manual denylist on
  top of the breach check.
- **Windows local PHP + HIBP breach-check silently failing open**: on
  Windows, PHP's cURL/OpenSSL often has no CA certificate bundle
  configured by default, so any outbound HTTPS call from PHP
  (including the breach-check's call to the HIBP API) fails with a
  cURL error 60 ("unable to get local issuer certificate"). Laravel's
  `uncompromised()` rule fails *open* on a connection error — meaning
  a breached password silently gets allowed through instead of
  blocked, with no visible error to the user. Symptom: obviously
  breached passwords like `iloveyou1` get accepted. Fix: download
  `https://curl.se/ca/cacert.pem`, set both `curl.cainfo` and
  `openssl.cafile` in `php.ini` to point at it, restart `artisan
  serve`. Confirmed this does NOT affect the actual Linux server —
  worth re-testing there once, but don't assume it's broken there too
  just because it was broken locally.

---

## Pre-merge checklist

- [ ] `.env` files never committed (check `git log --stat`)
- [ ] Fresh account: register → email verify → first login shows QR
      setup → scan + confirm → logs in → logout → login again shows
      code prompt (not QR again)
- [ ] Password policy rejects: <8 chars, no lowercase, no number, a
      known breached password (confirm this is ACTUALLY being checked
      — see the Windows CA gotcha above), an obvious term
      (admin/password), and reuse of the current or last-5 passwords
      — on both applicant and admin-created accounts
- [ ] Multiple simultaneous password errors render as a readable
      bulleted list, not a run-on sentence
- [ ] 5 wrong password attempts locks the account for 15 minutes
- [ ] Face-verification photo and event images load correctly on the
      **deployed server** (not just locally — the mixed-content bug
      only showed up there)
- [ ] No red errors in browser console across Login, Register, Profile,
      AdminEvents, Events, applicant dashboard
- [ ] `php artisan migrate:fresh` runs clean on a throwaway database
- [ ] Branch merged with target branch locally first, conflicts
      resolved and re-tested before pushing