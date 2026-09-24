#!/usr/bin/env bash
#
# SK-EAS backup script — dumps the MySQL database and archives uploaded
# files (documents, face-verification photos) into a single dated backup
# folder, then deletes backups older than RETENTION_DAYS.
#
# Run this ON THE SERVER (not locally). Meant to be called by cron — see
# BACKUP.md for the crontab line and full restore instructions.

set -euo pipefail

# ---- Config -----------------------------------------------------------
REPO_DIR="/var/www/sk-educational-assistance-system"
BACKUP_ROOT="/var/backups/sk-eas"
RETENTION_DAYS=14
ENV_FILE="$REPO_DIR/backend/.env"

# ---- Read DB credentials from the backend .env -------------------------
DB_DATABASE=$(grep -m1 '^DB_DATABASE=' "$ENV_FILE" | cut -d '=' -f2-)
DB_USERNAME=$(grep -m1 '^DB_USERNAME=' "$ENV_FILE" | cut -d '=' -f2-)
DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' "$ENV_FILE" | cut -d '=' -f2-)
DB_HOST=$(grep -m1 '^DB_HOST=' "$ENV_FILE" | cut -d '=' -f2-)
DB_PORT=$(grep -m1 '^DB_PORT=' "$ENV_FILE" | cut -d '=' -f2-)

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
DEST="$BACKUP_ROOT/$TIMESTAMP"
mkdir -p "$DEST"

# ---- Database dump ------------------------------------------------------
mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USERNAME" \
  --password="$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_DATABASE" | gzip > "$DEST/database.sql.gz"

# ---- Uploaded files (applicant documents, face-verification photos) ----
tar -czf "$DEST/storage-private.tar.gz" \
  -C "$REPO_DIR/backend/storage/app" private

# ---- Rotate old backups --------------------------------------------------
find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} \;

echo "Backup done: $DEST"
