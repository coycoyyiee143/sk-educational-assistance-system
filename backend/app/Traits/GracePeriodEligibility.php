<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

/**
 * Single source of truth for "does this claiming_assignments row belong
 * in the grace period pool" — used identically by VerifierController
 * (verifier-facing search) and AdminReportController (admin-facing
 * report/PDF). Previously this logic was duplicated independently in
 * both controllers and drifted out of sync — VerifierController's
 * version got two real fixes this session (surfacing an unswept
 * original no-show immediately, and recognizing a resolution that
 * happened during grace period even when source was never flipped from
 * 'original') that AdminReportController's copy never received, causing
 * the admin Grace Period Claiming List to silently omit applicants the
 * verifier's own search correctly showed. See docs/CLAIMING_RULES.md.
 */
trait GracePeriodEligibility
{
    /**
     * Covers three groups:
     *
     * 1. source: waitlist_promotion / grace_period_retry — ALWAYS grace
     *    period, unconditional on claim_status.
     *
     * 2. source: original, still UNRESOLVED — either already finalized
     *    unclaimed, or still pending_claiming with its lane day already
     *    passed while grace period is CURRENTLY open (surfaced
     *    immediately, not waiting on the hourly sweep).
     *
     * 3. source: original, RESOLVED (claimed/not_cleared), where
     *    verified_at falls on/after the schedule's grace_period_date —
     *    meaning they walked in during grace period even though their
     *    assignment's source was never flipped away from 'original'.
     */
    private function applyGracePeriodEligibleCondition(Builder $query, string $today): Builder
    {
        return $query->where(function ($q1) use ($today) {
            $q1->whereIn('source', ['waitlist_promotion', 'grace_period_retry'])
                ->orWhere(function ($q2) use ($today) {
                    $q2->where('source', 'original')
                        ->where(function ($q3) use ($today) {
                            $q3->where('claim_status', 'unclaimed')
                                ->orWhere(function ($q4) use ($today) {
                                    $q4->where('claim_status', 'pending_claiming')
                                        ->whereHas('lane', fn($l) => $l->where('claiming_date', '<', $today))
                                        ->whereHas('schedule', fn($s) => $s->whereNotNull('grace_period_date')
                                            ->whereNotNull('grace_period_end_date')
                                            ->where('grace_period_date', '<=', $today)
                                            ->where('grace_period_end_date', '>=', $today));
                                })
                                ->orWhere(function ($q5) {
                                    $q5->whereIn('claim_status', ['claimed', 'not_cleared'])
                                        ->whereNotNull('verified_at')
                                        ->whereHas('schedule', function ($s) {
                                            $s->whereNotNull('grace_period_date')
                                                ->whereRaw('claiming_schedules.grace_period_date <= DATE(claiming_assignments.verified_at)');
                                        });
                                });
                        });
                });
        });
    }

    /**
     * Category label for a row already known to be grace-period-eligible
     * (i.e. passed applyGracePeriodEligibleCondition()). Only two
     * categories: Promoted (waitlist_promotion) or Retrying (everything
     * else — grace_period_retry, or an original no-show/late-resolution
     * that never got formally swept).
     */
    private function gracePeriodType(string $source): string
    {
        return $source === 'waitlist_promotion' ? 'promoted' : 'retrying';
    }
}