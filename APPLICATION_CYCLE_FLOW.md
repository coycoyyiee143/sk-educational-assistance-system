# Application Cycle Flow — How It Works

This document walks through the full lifecycle of one application
period, from admin setup through final reporting — both the admin side
(configuring the period, publishing schedules, closing it out) and the
applicant side (registering, applying, claiming). For the underlying
business rules (status values, source values, eligibility conditions),
see `CLAIMING_RULES.md`.

---

## Part 1: Admin — Opening a Period

An admin creates a new `ApplicationConfiguration` — school year, open
date, close date, how many slots are available (or unlimited), and the
assistance amount per applicant. Once a period is open, applicants can
register and apply.

The assistance amount and slot count are locked once the period opens,
the same way `school_year` is — this keeps every applicant in that
period held to the same terms, and keeps historical reports accurate
even if a later period's amount changes.

---

## Part 2: Applicant — Registration

Every applicant registers a face at signup — they upload a photo of
their ID and take a live selfie, and the system compares the two and
stores the result as their permanent reference (`FaceVerification.face_embedding`
and `live_photo_path`). This step is **atomic with account creation** —
there is no way to have a logged-in account without a verified face on
file. This is what every later claiming-day check compares against.

---

## Part 3: Applicant — Applying

The applicant submits their application and documents. OCR checks run
automatically — missing fields get flagged for reupload, borderline
findings get routed to a human verifier with a suggested action, never
auto-rejected.

A verifier reviews and either approves or rejects the application.

- **Approved, slot available** → the applicant is assigned to the
  regular claiming pipeline (see Part 5). A slot is reserved
  (`slots_filled` increments).
- **Approved, no slot available** → the applicant is placed on the
  waitlist, in strict FIFO order.
- **Rejected** → done, no further pipeline.

---

## Part 4: Waitlist (if applicable)

Waitlisted applicants wait until a `not_cleared` outcome elsewhere
frees a slot. At that point the next person in line is automatically
promoted — first-come-first-served, no manual picking (an admin can
trigger a single promotion or promote everyone the current slot count
allows).

A promoted applicant **skips regular claiming entirely** and lands
directly in Grace Period Claiming (`source: waitlist_promotion`),
since regular claiming days have usually already happened by the time
a promotion occurs.

---

## Part 5: Admin — Publishing the Claiming Schedule

Once enough applicants are approved, an admin publishes a claiming
schedule: a location, one or more lanes (tables), each with a specific
date and morning/afternoon batch, and a grace period window
(`grace_period_date` → `grace_period_end_date`) for later.

Approved applicants are automatically split across the published
lanes. Each gets a `ClaimingAssignment` row: `claim_status: pending_claiming`,
`source: original`.

**Rule:** every regular lane's date must fall before `grace_period_date`.
By the time grace period opens, every regular lane's date is
necessarily already in the past — this is what lets the system safely
treat any unresolved `original` applicant as "eligible for grace
period" the moment their lane day passes.

---

## Part 6: Admin — Assigning Verifiers to Lanes

Separately from publishing the schedule, an admin (or a verifier
self-assigning) sets who's working which lane. This is kept
independent of the schedule-publish step, since staffing is a
same-day operational decision, not something locked in weeks ahead.

---

## Part 7: Regular Claiming Day

The applicant shows up at their assigned lane. The verifier:

1. Sees the applicant's registration photo automatically, at zero
   cost — no capture, no click.
2. Optionally runs an active face check against that same reference
   (optional here — the scheduled lane + control number already carry
   most of the identity proof).
3. Checks physical documents against what was uploaded online.
4. Marks **Claimed** or **Not Cleared**. Either outcome is locked
   permanently the moment it's set — no re-clicking, no undo through
   the UI.

`Not Cleared` frees the applicant's slot, which is what lets a
waitlisted applicant get promoted.

If the applicant doesn't show up at all, nothing happens automatically
in that instant — their row just sits overdue until the next sweep.

---

## Part 8: The Daily Sweep

Once a day, a background job scans for anyone whose claiming day has
passed with no action taken, and asks: is grace period still open?

- **Yes** → moved onto the shared "Grace Period Claiming" lane,
  `source` becomes `grace_period_retry`, given a second chance.
- **No** → finalized permanently as `claim_status: unclaimed`. No
  further chances, no manual override — a verifier never clicks
  "mark as no-show"; the absence of any action already tells the
  story.

This same job also finalizes anyone still unresolved once grace period
itself ends (see Part 10).

---

## Part 9: Grace Period — the Second-Chance Window

A flexible, multi-day window where two kinds of people can walk in
anytime, in no particular order:

- **Retrying** — an original no-show, either already reassigned by the
  sweep or not yet caught up to (shown here immediately either way).
- **Promoted** — came directly off the waitlist (Part 4).

**Face verification is mandatory here, not optional.** A grace-period
walk-in has no scheduled lane or appointed time proving who they are —
so the verifier cannot mark anyone Claimed without a passing face
match on file for that specific attempt. Every attempt (photo, score,
timestamp, verifying staff) is saved permanently and never overwritten,
so even repeated retries each keep independent proof.

The registration photo is shown here automatically too, same as
regular claiming.

---

## Part 10: End of Grace Period

The sweep keeps running daily throughout the grace period window.
Anyone still unresolved once `grace_period_end_date` passes —
regardless of how they got there — is finalized to `unclaimed`, the
same permanent terminal state as Part 8.

---

## Part 11: Admin — Closing the Period

Once grace period has genuinely ended, an admin can close the period.
This is a deliberate, manual action, distinct from the close date
simply passing:

- Every still-`waitlisted` applicant (never promoted, ran out of room
  before the period ended) is transitioned to `not_selected` — not a
  rejection, just "there wasn't room in time."
- `closed_at` is stamped on the period, marking it fully settled.

---

## Part 12: Reporting

Everything above feeds into what SK reviews, during or after the
period:

- **Disbursement Report** — who got money, when, by which verifier,
  with face-verification proof attached if one was run.
- **Grace Period Claiming List** — live view of who's still
  retrying/promoted, using the exact same rule the verifier's own
  search uses, so admin and verifier can never show different people.
- **Claiming Outcome Summary** — claimed / not-cleared / unclaimed
  rates for the period.
- **Applicant Records** — filterable by any status, including
  `unclaimed` and `not_selected`.

---

## The Whole Cycle, Top to Bottom

See `APPLICATION_CYCLE_DIAGRAM.md` for the full diagram.