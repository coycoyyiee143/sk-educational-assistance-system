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
6. **Blocked an admin from resetting their own password** via the
   personnel Reset Password flow — found this the hard way during
   testing (locked myself out). Guarded on both frontend (button
   disabled on own row) and backend (422 if target id matches
   requester id).
7. **TOTP issuer hardcoded, QR setup screen labeled with the account
   email.** `TwoFactorService` no longer relies on `config('app.name')`
   — that key always has *some* value (Laravel's own default is
   literally the string `"Laravel"`), so a fallback there would never
   actually trigger. Issuer is now the hardcoded `Mamatid SK-EAS`,
   shown consistently in both the authenticator app and the login
   screen's own labeling of which account is being set up.
8. **Clearer error when deleting a personnel account with activity
   history.** Several tables (`application_configurations`,
   `announcements`, `sk_events`, `verifier_actions`, claiming-related
   tables) reference `users` via foreign keys with no `ON DELETE` rule
   — meaning MySQL blocks deletion of any account that's ever posted,
   approved, or verified anything. This is *correct* behavior (an
   account with real history shouldn't be silently erasable — it'd
   destroy accountability), the bug was only that the error surfaced
   as a generic "Failed to delete user" with no explanation.
   `deleteUser()` now catches the constraint violation and tells the
   admin to Deactivate instead.

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
| `app/Http/Controllers/Api/AdminController.php` | `createPersonnel()` — no password field, generates token via `forceFill()` (NOT `create()` — those columns aren't in `$fillable`, `create()` would've silently dropped them). `resetPassword()` — same token mechanism, scoped to `sk_verifier`/`sk_admin` only, blocks resetting your own account. `deleteUser()` — catches FK constraint violations and returns a specific "deactivate instead" message. |
| `app/Http/Controllers/Api/PasswordResetController.php` | `resetPassword()` now enforces the full password policy and records to `PasswordHistory` |
| `app/Services/TwoFactorService.php` | `ISSUER` hardcoded to `Mamatid SK-EAS` instead of reading `config('app.name')`, which always has a value regardless of whether `APP_NAME` is set |
| `app/Http/Controllers/Api/AuthController.php` | `login()`'s `requires_2fa_setup` response now includes `email`, so the frontend can label which account the QR belongs to |
| `app/Models/User.php` | `$hidden` now includes `google2fa_secret`, `verification_token`, `verification_code` |
| `routes/api.php` | Added `GET`/`POST /personnel/setup/{token}` (public) and `POST /admin/users/{id}/reset-password` (inside the `role:sk_admin` group) |

No new migration — this reuses the `verification_token` /
`verification_token_expires_at` columns already on `users` from the
applicant email-verification flow.

### Frontend (`frontend/`)

| File | Purpose |
|---|---|
| `src/admin/pages/AdminUsers.jsx` | `AddPersonnelModal` — password field removed entirely, replaced with a note explaining the link will be emailed. Personnel table — "Reset Password" action per row (disabled on the admin's own row), a "Setup Pending" badge for accounts that haven't clicked their link yet, and `deleteUser()` now surfaces the backend's specific error message instead of a hardcoded generic one |
| `src/public/pages/PersonnelSetup.jsx` | New page — the `/personnel/setup/:token` route. Validates the token on load, shows "Welcome, {name}" + a password form (same checklist/error-list UI pattern as `ForgotPassword.jsx`), or an "invalid/expired" state |
| `src/public/pages/ForgotPassword.jsx` | Reset step now has the live password checklist and checklist-style error list, matching the rest of the app |
| `src/public/pages/Login.jsx` | QR setup screen now shows which account email the code is being set up for, alongside the (now-hardcoded) issuer name |

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
- **Self-reset guard**: confirmed as a real bug, not just a theoretical
  one — this happened during testing. Resetting your own account kills
  your current password and revokes your session immediately; if the
  email on that account isn't real/reachable, you're locked out with
  no recovery path short of `migrate:fresh` or manual `tinker`
  intervention. Fixed on both frontend (`AdminUsers.jsx` disables the
  "Reset Password" button on the admin's own row) and backend
  (`AdminController::resetPassword()` returns 422 if the target id
  matches the requester's id) — the backend check matters even with
  the frontend guard in place, since a direct API call could otherwise
  bypass the disabled button.
- **`FRONTEND_URL` must be set correctly in production**, not just
  local `.env` — if it's missing or wrong in the deployed
  environment's `.env`, the setup links emailed to real verifiers/
  admins would point at the wrong domain entirely. Confirm this on the
  server specifically, don't assume local correctness carries over.
- **Deleting a personnel account with activity history is blocked by
  design, not a bug.** `application_configurations`, `announcements`,
  `sk_events`, `verifier_actions`, and the claiming-related tables all
  reference `users` with no `ON DELETE` rule, so MySQL blocks deletion
  of any account that's ever posted, approved, or verified anything.
  Considered fixing the foreign keys to `SET NULL` instead (would let
  hard-delete succeed, just orphaning the "who did this" reference) —
  decided against it. An account with real history destroying that
  accountability trail on delete is worse than the delete failing.
  Deactivate is the correct action for any account that's actually
  been used; Delete only cleanly works for accounts created by
  mistake before they've done anything. The fix that WAS made:
  `deleteUser()` now catches the constraint violation and tells the
  admin to deactivate instead, rather than a bare "Failed to delete
  user" with no explanation.
- **`config('app.name')` is not a safe fallback-detection mechanism.**
  It was tempting to write `config('app.name', 'SK-EAS')` in
  `TwoFactorService` assuming the second argument kicks in if
  `APP_NAME` isn't set — it doesn't. Laravel's own `config/app.php`
  already defaults `'name' => env('APP_NAME', 'Laravel')`, so the key
  always resolves to something (worst case, the literal string
  `"Laravel"`). A `config()` call's own default argument only applies
  if the key is entirely missing from the config array, which it
  never is here. Fixed by hardcoding the TOTP issuer name directly in
  the service instead of routing through `app.name` at all.

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
- [ ] Confirm an admin CANNOT reset their own password via the
      personnel Reset Password button — the button should be disabled
      on their own row, and a direct API call to the endpoint should
      return a 422 rather than actually resetting anything
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
- [ ] Authenticator app shows "Mamatid SK-EAS (email)" on scan, not
      "Laravel (email)" — confirms the issuer fix took effect
- [ ] Deleting a personnel account with real activity history shows
      the specific "deactivate instead" message, not a generic failure
- [ ] Deleting a personnel account with NO activity history still
      succeeds normally (confirms the fix didn't accidentally block
      legitimate deletes too)