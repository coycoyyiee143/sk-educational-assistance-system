#!/usr/bin/env bash
#
# SK-EAS restore script — restores the MySQL database and uploaded files
# from a backup folder created by backup.sh.
#
# Run this ON THE SERVER. See BACKUP.md for the full walkthrough.
#
# Usage:
#   ./restore.sh /var/backups/sk-eas/2026-09-19_02-00-00

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-backup-folder>"
  exit 1
fi

SRC="$1"
REPO_DIR="/var/www/sk-educational-assistance-system"
ENV_FILE="$REPO_DIR/backend/.env"

if [ ! -f "$SRC/database.sql.gz" ] || [ ! -f "$SRC/storage-private.tar.gz" ]; then
  echo "Error: $SRC does not look like a backup.sh output folder."
  exit 1
fi

DB_DATABASE=$(grep -m1 '^DB_DATABASE=' "$ENV_FILE" | cut -d '=' -f2-)
DB_USERNAME=$(grep -m1 '^DB_USERNAME=' "$ENV_FILE" | cut -d '=' -f2-)
DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' "$ENV_FILE" | cut -d '=' -f2-)
DB_HOST=$(grep -m1 '^DB_HOST=' "$ENV_FILE" | cut -d '=' -f2-)
DB_PORT=$(grep -m1 '^DB_PORT=' "$ENV_FILE" | cut -d '=' -f2-)

echo "About to restore from: $SRC"
echo "This will OVERWRITE the current '$DB_DATABASE' database and the"
echo "current backend/storage/app/private folder. Press Enter to continue,"
echo "Ctrl+C to cancel."
read -r _

# ---- Restore database ----------------------------------------------------
gunzip -c "$SRC/database.sql.gz" | mysql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USERNAME" \
  --password="$DB_PASSWORD" \
  "$DB_DATABASE"

# ---- Restore uploaded files ----------------------------------------------
rm -rf "$REPO_DIR/backend/storage/app/private"
tar -xzf "$SRC/storage-private.tar.gz" -C "$REPO_DIR/backend/storage/app"

echo "Restore complete. Now run:"
echo "  cd $REPO_DIR/backend && php artisan config:clear"
echo "  sudo systemctl restart sk-eas-backend"
echo "  sudo systemctl restart sk-eas-queue-notifications"
echo "  sudo systemctl restart sk-eas-queue-ocr"
