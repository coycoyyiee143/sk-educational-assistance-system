# Backups & Restore — SK-EAS

How to back up and restore the database and uploaded files (applicant
documents, face-verification photos) on the production server. Pairs
with `DEPLOYMENT.md`.

What gets backed up:
- The MySQL database (`skeas_db`) — applicants, users, applications, etc.
- `backend/storage/app/private` — uploaded documents and face-verification
  photos. (`storage/app/public` is not backed up; it holds regenerable
  public assets, not applicant data.)

Backups are stored **on the server itself**, under `/var/backups/sk-eas`,
one dated folder per run, auto-deleted after 14 days. This protects
against bad deploys, accidental deletes, and DB corruption — it does
**not** protect against the whole server/disk dying. If that matters
later, the same scripts can be pointed at an external destination
(S3, another machine via `scp`) — ask for that when it's needed.

Backup status is also visible in the app itself — **System
Maintenance** page (superadmin and it_support only) shows the latest
backup's timestamp, size, and a history of recent runs, plus a **Run
Backup Now** button that triggers `scripts/backup.sh` on demand
(non-destructive — it only ever creates a new dated folder, never
touches existing backups or live data). Restoring is deliberately
**not** available from that page — it's destructive, so it stays
CLI/SSH-only, per the steps below.

---

## 1. One-time setup on the server

```bash
ssh skadmin@<server-ip-or-hostname>
sudo mkdir -p /var/backups/sk-eas
sudo chown skadmin:skadmin /var/backups/sk-eas
cd /var/www/sk-educational-assistance-system
chmod +x scripts/backup.sh scripts/restore.sh
```

Run it once by hand to confirm it works:

```bash
./scripts/backup.sh
ls /var/backups/sk-eas
```

You should see a new dated folder containing `database.sql.gz` and
`storage-private.tar.gz`.

## 2. Schedule it (daily backup via cron)

```bash
crontab -e
```

Add this line (runs every day at 2:00 AM server time):

```
0 2 * * * /var/www/sk-educational-assistance-system/scripts/backup.sh >> /var/log/sk-eas-backup.log 2>&1
```

Save and exit. Confirm it's registered:

```bash
crontab -l
```

---

## 3. Restoring from a backup (in case of a crash / bad data)

```bash
ssh skadmin@<server-ip-or-hostname>
cd /var/www/sk-educational-assistance-system
ls /var/backups/sk-eas          # pick the dated folder you want
./scripts/restore.sh /var/backups/sk-eas/<the-folder-you-picked>
```

The script asks for confirmation before overwriting anything (it
**replaces** the current database and the current
`backend/storage/app/private` folder — there's no undo, so double-check
the folder name). After it finishes, it prints the restart commands to
run (same ones as a normal backend deploy in `DEPLOYMENT.md`).

## 4. Restoring just the database, or just the files

If you only need one piece, you don't need the script — pull the
relevant command out of it:

**Database only:**
```bash
gunzip -c /var/backups/sk-eas/<folder>/database.sql.gz | mysql -u root -p skeas_db
```

**Files only:**
```bash
rm -rf backend/storage/app/private
tar -xzf /var/backups/sk-eas/<folder>/storage-private.tar.gz -C backend/storage/app
```

---

## Checking backups are actually running

```bash
ls -la /var/backups/sk-eas          # should have a folder for (roughly) each day
tail -50 /var/log/sk-eas-backup.log # cron's output/errors land here
```

If `ls` shows nothing newer than a few days, the cron job likely isn't
running — check `crontab -l` and the log file for errors (most common
cause: wrong DB password in `backend/.env`, or `/var/backups/sk-eas`
permissions).
