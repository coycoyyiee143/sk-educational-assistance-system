# Application Cycle — Full Diagram

Companion to `APPLICATION_CYCLE_FLOW.md` (full written walkthrough) and
`CLAIMING_RULES.md` (underlying business rules). This file is just the
diagram, kept separate so the ASCII alignment doesn't break when
copied into other docs or tools that don't preserve code fencing.

```
ADMIN: Open period (config, slots, amount)
    |
Register (face verified, permanently, atomic with signup)
    |
Apply -> OCR checks -> Verifier review
    |
    |-- Rejected --> done
    |
    +-- Approved
          |
     Slot available?
          |
    +-----+-----+
    |           |
   Yes          No --> Waitlisted --> promoted later,
    |                  skips straight to Grace Period
ADMIN: Publish            (source: waitlist_promotion)
claiming schedule
    |
Assigned to a
regular lane
(source: original)
    |
Regular Claiming Day
    |
 +--+--+
 |     |
Shows  Doesn't
up     show
 |       |
+-+   Sweep (daily): grace period still open?
Claimed        |                    |
Not Cleared   Yes                   No
(locked,       |                    |
 either way) Moved to Grace    Finalized: unclaimed
             Period Claiming    (locked, permanent)
             (source:
              grace_period_
              retry)
                  |
             +----+----+
             |         |
           Shows up   Doesn't show up before
           during      grace_period_end_date
           grace           |
              |       Finalized: unclaimed
        FACE VERIFICATION
           REQUIRED
              |
          +---+---+
          |       |
        Claimed  Not Cleared
        (locked)  (locked)
                  |
ADMIN: Close period (grace period over)
    -> remaining waitlisted -> not_selected
    |
Reporting (disbursement, outcomes, records)
```