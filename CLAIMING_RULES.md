# Claiming System — Business Rules

This is the single source of truth for how claiming status, sources, and
grace period logic are supposed to work. Before writing any code that
touches `claim_status`, `source`, or grace period dates, check here first.
Every rule below traces to at least one real bug this session — written
by hand, bypassing the actual code path, producing a state the real app
could never reach.

## The two status fields — kept separate, on purpose

- `Application.status` — did this person qualify to receive assistance.
- `ClaimingAssignment.claim_status` — did they actually receive it.

These are NOT merged into one field. They answer different questions.
`updateClaimStatus()` keeps them in sync for `claimed`/`not_cleared`
(both fields get updated together). **Known gap:** `unclaimed` is
NEVER written to `Application.status` anywhere — `SweepUnclaimedAssignments`
only touches `ClaimingAssignment.claim_status`. Any report counting by
`Application.status` alone will silently miss finalized no-shows. Not
yet fixed — flag before relying on `Application.status = 'unclaimed'`
anywhere.

If you need one combined display value (not a combined field), compute
it — don't store it. See `StatusConstants.js` for the `Application.status`
side; there is currently no equivalent single function that reads BOTH
fields together for display. Worth building if this keeps coming up.

## `claim_status` values

| Value | Meaning | Who sets it |
|---|---|---|
| `pending_claiming` | Active, unresolved — has a real chance to claim right now | Default on assignment creation |
| `claimed` | Successfully received | `updateClaimStatus()` only |
| `not_cleared` | Showed up, documents didn't match | `updateClaimStatus()` only |
| `unclaimed` | **TERMINAL.** Missed their chance permanently | `SweepUnclaimedAssignments` only |

**Rule: `unclaimed` can ONLY be written by the sweep, and ONLY once
`grace_period_end_date` has genuinely passed** (or no grace period is
configured at all). It is never a manual verifier action — the button
was removed on purpose. **Never hand-write `claim_status: 'unclaimed'`
in a seeder or migration while a schedule's grace period is still open.**
That state is impossible in production and breaks the eligibility query.
(This exact mistake happened twice this session — Pedro in
`VerifierClaimingUiTestSeeder`, and `FullDemoSeeder::applyUnclaimedOutcomes()`.)

## `source` values

| Value | Meaning |
|---|---|
| `original` | Assigned during the regular published schedule |
| `waitlist_promotion` | Created by `promoteFromWaitlist()`/`promoteAllFromWaitlist()` |
| `grace_period_retry` | Created ONLY by `SweepUnclaimedAssignments` reassigning an `original` no-show |

**Rule: only the sweep can set `source: grace_period_retry`.** Don't
hand-write it directly in a seeder unless you're specifically simulating
"the sweep already ran" — and if you do, the assignment must also be
on the shared flex lane (see below), not a regular dated lane.

## The shared flex lane

Both `waitlist_promotion` and `grace_period_retry` assignments sit on
ONE shared lane per schedule, named **"Grace Period Claiming"**
(renamed from "Waitlist Promotions" — check any seeder/file still using
the old string, it needs the same rename or you'll get two lanes).
The lane name does NOT distinguish the two types — `source` does. Don't
try to infer applicant type from lane name.

## Slot accounting

- `not_cleared` → **decrements** `slots_filled` (frees the slot for
  waitlist promotion). Only fires once, gated on the previous status
  not already being `not_cleared`.
- `unclaimed` → does **NOT** decrement `slots_filled`. The slot stays
  reserved through the whole grace period, per confirmed business rule.
  If they never show, the slot simply goes unfilled for the cycle.

## Regular Claiming vs. Grace Period List — the eligibility rule

One function decides this, shared via the `GracePeriodEligibility` trait
and used identically by both `VerifierController::searchClaiming()` and
`AdminReportController::buildGracePeriodClaimingList()` — as an
inclusion filter (`whereHas`) in Grace mode / the admin report, and an
exclusion filter (`whereDoesntHave`) in Regular mode, so all three
views can never disagree: `GracePeriodEligibility::applyGracePeriodEligibleCondition()`.

An assignment is grace-period-eligible if ANY of:
1. `source` is `waitlist_promotion` or `grace_period_retry` —
   **unconditional on `claim_status`.** Even once resolved
   (claimed/not_cleared), it stays here as history. Never bounces back
   to Regular just because the status changed.
2. `source: original`, still unresolved, AND either:
   - `claim_status: unclaimed` (finalized), or
   - `claim_status: pending_claiming` with its lane's `claiming_date`
     already past AND grace period currently open (surfaced
     immediately — don't wait for the hourly sweep to formally
     reassign it first)
3. `source: original`, RESOLVED (`claimed`/`not_cleared`), AND
   `verified_at` falls on/after the schedule's `grace_period_date` —
   meaning they walked in during grace period even though the sweep
   never got to flip their `source` first.

**Regular lane days are always scheduled BEFORE grace period starts.**
By definition, once grace period opens, every `original` lane's date
is already in the past. There is no scenario where grace period is
open and an `original` applicant's lane day hasn't happened yet.

## Face verification

- **Grace period claims (`waitlist_promotion`/`grace_period_retry`):
  MANDATORY.** `updateClaimStatus()` rejects `claimed` unless a passing
  `ClaimingFaceVerification` row exists for that assignment.
- **Regular claiming: optional**, verifier's judgment call. Not
  backend-enforced.
- Each verification attempt gets its OWN row in
  `claiming_face_verifications` — never overwrites a prior attempt, so
  multiple grace-period retries each keep independent proof.

## UI display rules

- Regular Claiming and Grace Period List tabs must NEVER show the same
  applicant simultaneously — the eligibility function above is the only
  source of truth for which tab an applicant belongs on.
- The "Type" column/badge (Promoted vs. Retrying) only renders in Grace
  Period mode. In Regular mode, resolved history rows show no type
  badge at all.
- Once `claim_status` is terminal (`claimed`, `not_cleared`, or
  `unclaimed`), the Claiming Action buttons must be disabled/hidden —
  no further status change through this UI. Only the sweep or a future
  admin-override path should ever touch a resolved row.