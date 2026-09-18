<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

/**
 * Single source of truth for "does this claiming_assignments row belong
 * in the Late Claiming pool" — used identically by VerifierController
 * (verifier-facing search) and AdminReportController (admin-facing
 * report/PDF). Previously this logic was duplicated independently in
 * both controllers and drifted out of sync — VerifierController's
 * version got two real fixes this session (surfacing an unswept
 * original no-show immediately, and recognizing a resolution that
 * happened during Late Claiming even when source was never flipped from
 * 'original') that AdminReportController's copy never received, causing
 * the admin Late Claiming List to silently omit applicants the
 * verifier's own search correctly showed. See docs/CLAIMING_RULES.md.
 */
trait LateClaimingEligibility
{
    /**
     * Covers three groups:
     *
     * 1. source: waitlist_promotion / late_claiming_retry — ALWAYS late
     *    claiming, unconditional on claim_status.
     *
     * 2. source: original, still UNRESOLVED — either already finalized
     *    unclaimed, or still pending_claiming with its lane day already
     *    passed while Late Claiming is CURRENTLY open (surfaced
     *    immediately, not waiting on the hourly sweep).
     *
     * 3. source: original, RESOLVED (claimed/not_cleared), where
     *    verified_at falls on/after the schedule's late_claiming_date —
     *    meaning they walked in during Late Claiming even though their
     *    assignment's source was never flipped away from 'original'.
     */
    private function applyLateClaimingEligibleCondition(Builder $query, string $today): Builder
    {
        return $query->where(function ($q1) use ($today) {
            $q1->whereIn('source', ['waitlist_promotion', 'late_claiming_retry'])
                ->orWhere(function ($q2) use ($today) {
                    $q2->where('source', 'original')
                        ->where(function ($q3) use ($today) {
                            $q3->where('claim_status', 'unclaimed')
                                ->orWhere(function ($q4) use ($today) {
                                    $q4->where('claim_status', 'pending_claiming')
                                        ->whereHas('lane', fn($l) => $l->where('claiming_date', '<', $today))
                                        ->whereHas('schedule', fn($s) => $s->whereNotNull('late_claiming_date')
                                            ->whereNotNull('late_claiming_end_date')
                                            ->where('late_claiming_date', '<=', $today)
                                            ->where('late_claiming_end_date', '>=', $today));
                                })
                                ->orWhere(function ($q5) {
                                    $q5->whereIn('claim_status', ['claimed', 'not_cleared'])
                                        ->whereNotNull('verified_at')
                                        ->whereHas('schedule', function ($s) {
                                            $s->whereNotNull('late_claiming_date')
                                                ->whereRaw('claiming_schedules.late_claiming_date <= DATE(claiming_assignments.verified_at)');
                                        });
                                });
                        });
                });
        });
    }

    /**
     * Category label for a row already known to be Late-Claiming-eligible
     * (i.e. passed applyLateClaimingEligibleCondition()). Only two
     * categories: Promoted (waitlist_promotion) or Retrying (everything
     * else — late_claiming_retry, or an original no-show/late-resolution
     * that never got formally swept).
     */
    private function lateClaimingType(string $source): string
    {
        return $source === 'waitlist_promotion' ? 'promoted' : 'retrying';
    }
}
