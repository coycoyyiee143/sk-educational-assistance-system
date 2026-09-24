<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Backup storage path
    |--------------------------------------------------------------------------
    |
    | Where scripts/backup.sh writes its dated backup folders. Must match
    | BACKUP_ROOT in scripts/backup.sh. On the production server this is
    | /var/backups/sk-eas (outside the repo, so it survives redeploys).
    |
    */

    'path' => env('BACKUP_PATH', '/var/backups/sk-eas'),

    /*
    |--------------------------------------------------------------------------
    | Backup script path
    |--------------------------------------------------------------------------
    |
    | The scripts/ folder lives at the repo root, one level up from
    | backend/ (this app's base_path()).
    |
    */

    'script_path' => env('BACKUP_SCRIPT_PATH', dirname(base_path()) . '/scripts/backup.sh'),

    /*
    |--------------------------------------------------------------------------
    | Staleness threshold
    |--------------------------------------------------------------------------
    |
    | Backups run daily (see BACKUP.md) — a latest backup older than this
    | many hours means the last one or more scheduled runs didn't happen.
    | Shared by AdminReportController::backupStatus() (UI badge) and the
    | CheckBackupHealth command (email alert), so they never disagree.
    |
    */

    'stale_after_hours' => env('BACKUP_STALE_AFTER_HOURS', 26),

];
