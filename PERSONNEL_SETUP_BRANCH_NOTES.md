# Personnel Account Setup Branch Documentation — feature/personnel-account-setup

Companion doc to `SECURITY_BRANCH_NOTES.md` (from `feature/password-otp-security`).
That doc covers password policy, lockout, and TOTP 2FA — this one covers
everything added on top of it in this branch.

---

## What this branch adds

1. **Admin-created verifier/admin accounts no longer get a password
   set by the admin.** The admin only submits name + email + role. The
   account gets an unguessable placeholder password and a one-time
   setup link emailed to the new person — they choose their own
   password by clicking it. Neither the admin nor anyone else ever
   sees or transmits the real password.
2. **Admin-initiated password reset**, same mechanism: kills the
   current password immediately, revokes all active sessions, emails a
   fresh setup link.
3. **Fixed a real bug**: `createPersonnel()` previously never
   triggered anything that set `email_verified_at` — meaning
   admin-created accounts could never pass the email-verified check in
   `login()` and were permanently locked out. Clicking the setup link
   now sets it as part of the same action.
4. **Fixed the forgot-password flow's password policy gap**:
   `PasswordResetController::resetPassword()` previously only checked
   `min:8|confirmed` — a complete bypass of breach-check, weak-term
   denylist, and reuse-block. Now uses the same full policy as every
   other password-writing path, and records the new password into
   `PasswordHistory` (which it never did before).
5. **Fixed a security leak in `User.php`**: `google2fa_secret`,
   `verification_token`, and `verification_code` were missing from
   `$hidden` — every API response returning a user object was leaking
   the literal TOTP seed and active setup/reset/verification tokens in
   plain JSON.

---

## Why a link, not a temp password

An earlier version of this feature emailed a plaintext temporary
password and used a `must_change_password` flag + middleware to force
a change on first login. That version worked, but a real password —
even temporary — sitting in an email inbox is a worse security posture
than a one-time link. The current design: the account's password is a
random 40-character string nobody knows, ever. The account is simply
*unusable* until the link is clicked. No temp credential ever exists
in a state where it could be intercepted and used to log in.

If you find remnants of the old approach anywhere (a
`must_change_password` migration, `ForcePasswordChange` middleware,
`TempPasswordMail`), they were never merged — this branch replaces
that design outright, not layers on top of it.

---

## File map

### Backend (`backend/`)

| File | Purpose |
|---|---|
| `config/app.php` | Added `frontend_url` config key, reading `FRONTEND_URL` from `.env` — used to build the setup link pointing at the React frontend instead of the Laravel backend |
| `app/Mail/PersonnelAccountMail.php` | One mailable, two modes (`isNewAccount` bool controls copy) — used for both first-time setup and admin resets |
| `resources/views/emails/personnel-account-setup.blade.php` | The email template |
| `app/Http/Controllers/Api/PersonnelSetupController.php` | Public (no-auth) controller: `show()` validates a token and returns the person's first name before they see the form; `store()` actually sets the password |
| `app/Http/Controllers/Api/AdminController.php` | `createPersonnel()` — no password field, generates token via `forceFill()` (NOT `create()` — those columns aren't in `$fillable`, `create()` would've silently dropped them). `resetPassword()` — new method, same token mechanism, scoped to `sk_verifier`/`sk_admin` only |
| `app/Http/Controllers/Api/PasswordResetController.php` | `resetPassword()` now enforces the full password policy and records to `PasswordHistory` |
| `app/Models/User.php` | `$hidden` now includes `google2fa_secret`, `verification_token`, `verification_code` |
| `routes/api.php` | Added `GET`/`POST /personnel/setup/{token}` (public) and `POST /admin/users/{id}/reset-password` (inside the `role:sk_admin` group) |

No new migration — this reuses the `verification_token` /
`verification_token_expires_at` columns already on `users` from the
applicant email-verification flow.

### Frontend (`frontend/`)

| File | Purpose |
|---|---|
| `src/admin/pages/AdminUsers.jsx` | `AddPersonnelModal` — password field removed entirely, replaced with a note explaining the link will be emailed. Personnel table — added a "Reset Password" action per row (with a confirm dialog) and a "Setup Pending" badge for accounts that haven't clicked their link yet |
| `src/public/pages/PersonnelSetup.jsx` | New page — the `/personnel/setup/:token` route. Validates the token on load, shows "Welcome, {name}" + a password form (same checklist/error-list UI pattern as `ForgotPassword.jsx`), or an "invalid/expired" state |
| `src/public/pages/ForgotPassword.jsx` | (From earlier in the parent branch, listed here for completeness) — reset step now has the live password checklist and checklist-style error list, matching the rest of the app |

**Still needed — not done yet:** register the new route in your React
Router setup:
```jsx
<Route path="/personnel/setup/:token" element={<PersonnelSetup />} />
```
Exact placement depends on your routes file, which hasn't been shared
yet.

---

## Setup commands

No new package installs, no new migration. After pulling this branch:
```bash
cd backend
php artisan config:clear
```
(needed since `config/app.php` changed)

---

## Known gotchas

- **Mass-assignment silent drop**: `User::create([...])` silently
  ignores any key not in `$fillable` — no error, no warning. This bit
  `createPersonnel()` specifically: `verification_token` and
  `verification_token_expires_at` aren't in `$fillable`, so they must
  be set via `forceFill()` after `create()`, not inside the `create()`
  array itself. If you ever add a new column and wire it into a
  `create()` call, check `$fillable` first or use `forceFill()` to be
  safe regardless.
- **Test the reset-password flow on a throwaway account first**, not
  your only real admin account. If mail delivery fails silently (SMTP
  misconfigured, credentials wrong) and you've just invalidated your
  only admin's password, you're locked out until you manually fix it
  via `tinker`.
- **Self-reset UX gap (not fixed, just noted)**: nothing currently
  stops an admin from clicking "Reset Password" on their *own* account
  by mistake, which would immediately log them out of their own
  session. Not a security bug, just a possible annoyance — add a
  guard (`resetTarget.id !== currentUser.id`) if you want to prevent
  it.
- **`FRONTEND_URL` must be set correctly in production**, not just
  local `.env` — if it's missing or wrong in the deployed
  environment's `.env`, the setup links emailed to real verifiers/
  admins would point at the wrong domain entirely. Confirm this on the
  server specifically, don't assume local correctness carries over.

---

## Pre-merge checklist

- [ ] Create a new personnel account through the admin panel — confirm
      NO password field appears, and the created account can't log in
      until the setup link is used
- [ ] Click the setup link — confirm it shows "Welcome, {name}", sets
      a password successfully, and that account can then log in
      normally (through the existing 2FA-gated flow)
- [ ] Confirm an expired or already-used link shows the
      invalid/expired state, not a crash or blank page
- [ ] Reset an existing verifier/admin's password — confirm their old
      password stops working immediately and their existing session(s)
      are logged out
- [ ] Forgot-password flow (applicant-facing) rejects a breached
      password, an obvious weak term, and a reused password — same as
      every other password-writing path
- [ ] Inspect a raw login/register API response (Network tab) and
      confirm `google2fa_secret`, `verification_token`, and
      `verification_code` do NOT appear anywhere in the JSON
- [ ] React Router route for `/personnel/setup/:token` is registered
      and actually reachable
- [ ] `.env` files (including `FRONTEND_URL` correctness) verified on
      the actual deployed server, not just assumed from local config