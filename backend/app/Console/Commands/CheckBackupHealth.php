<?php

namespace App\Console\Commands;

use App\Mail\BackupHealthAlertMail;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Scheduled safety net for the backup cron job (scripts/backup.sh, see
 * BACKUP.md) silently failing or stopping — without this, nobody finds
 * out until someone happens to open System Maintenance. Applies the same
 * staleness/completeness rules as AdminReportController::backupStatus()
 * (the UI badge), reading the shared config('backup.stale_after_hours')
 * so the two never disagree.
 *
 * Alerts at most once per unhealthy streak: a marker file next to the
 * backups records that an alert already went out, so admins get one
 * email when it goes bad, not one every run until someone fixes it. The
 * marker is cleared as soon as a healthy backup is seen again, so a
 * fresh problem later still alerts.
 */
class CheckBackupHealth extends Command
{
    protected $signature = 'backup:check-health';

    protected $description = 'Emails superadmin/it_support if the latest backup is missing, incomplete, or stale.';

    public function handle(): int
    {
        $backupPath = config('backup.path');
        $staleAfterHours = (int) config('backup.stale_after_hours', 26);
        $markerFile = $backupPath ? rtrim($backupPath, '/\\') . DIRECTORY_SEPARATOR . '.health-alert-sent' : null;

        $reason = $this->unhealthyReason($backupPath, $staleAfterHours);

        if (!$reason) {
            if ($markerFile && is_file($markerFile)) {
                @unlink($markerFile);
            }
            $this->info('Backups healthy.');
            return self::SUCCESS;
        }

        if ($markerFile && is_file($markerFile)) {
            $this->info("Backups unhealthy ({$reason}), but already alerted — skipping.");
            return self::SUCCESS;
        }

        $admins = User::whereIn('role', ['it_support', 'superadmin'])
            ->where('is_active', true)
            ->get();

        foreach ($admins as $admin) {
            try {
                Mail::to($admin->email)->send(new BackupHealthAlertMail($admin->first_name, $reason));
            } catch (\Throwable $e) {
                \Log::error("Backup health alert failed to send to {$admin->email}: " . $e->getMessage());
            }
        }

        AuditLog::record('backup_health_alert', null, "Backup health alert sent: {$reason}");

        if ($markerFile) {
            @file_put_contents($markerFile, $reason . "\n" . now()->toIso8601String());
        }

        $this->warn("Backups unhealthy ({$reason}) — alert sent.");
        return self::SUCCESS;
    }

    private function unhealthyReason(?string $backupPath, int $staleAfterHours): ?string
    {
        if (!$backupPath || !is_dir($backupPath)) {
            return 'Backups are not configured on this server.';
        }

        $folders = collect(scandir($backupPath))
            ->reject(fn ($name) => in_array($name, ['.', '..']))
            ->filter(fn ($name) => is_dir($backupPath . DIRECTORY_SEPARATOR . $name))
            ->sortDesc()
            ->values();

        $latest = $folders->first();
        if (!$latest) {
            return 'No backups have been recorded yet.';
        }

        $dir = $backupPath . DIRECTORY_SEPARATOR . $latest;
        $dbOk = is_file($dir . DIRECTORY_SEPARATOR . 'database.sql.gz');
        $filesOk = is_file($dir . DIRECTORY_SEPARATOR . 'storage-private.tar.gz');
        if (!$dbOk || !$filesOk) {
            return "The latest backup ({$latest}) is incomplete — missing " . (!$dbOk ? 'the database dump' : 'the files archive') . '.';
        }

        $ageHours = (time() - filemtime($dir)) / 3600;
        if ($ageHours > $staleAfterHours) {
            $roundedHours = round($ageHours);
            return "The latest backup ({$latest}) is {$roundedHours} hours old — the scheduled run appears to have stopped.";
        }

        return null;
    }
}
