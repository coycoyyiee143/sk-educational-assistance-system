# SK-EAS Deploy Order (after `git pull`)

## 1. Get code
```
cd /var/www/sk-educational-assistance-system
git checkout <branch>
git pull
```

## 2. Database (pick ONE)

Normal deploy — keep existing data:
```
cd backend
php artisan migrate
```

Test only — wipes all data:
```
php artisan migrate:fresh
```
After migrate:fresh, no admin exists — make one via `php artisan tinker`.

## 3. Deploy what changed

### If Frontend (React) changed:
```
cd frontend
npm install
npm run build
```
Then hard refresh browser (Ctrl+Shift+R). No service restart needed.

### If Backend (Laravel PHP / Jobs / Services) changed:
```
cd backend
composer install --no-dev
php artisan config:clear
```
Then restart all 3 backend services (below). Queue workers hold OLD code in memory even after pull — restarting only sk-eas-backend and skipping queues = fix silently not deployed.

### If OCR service (Python) changed:
```
cd ocr-service
source venv/bin/activate
pip install -r requirements.txt
deactivate
sudo systemctl restart ocr-service
```

### If Face service (Python) changed:
```
cd face-service
source venv/bin/activate
pip install -r requirements.txt
deactivate
sudo systemctl restart face-service
```

## Backend cache policy: NOT caching (decided)
One-time cleanup already done. Do NOT run config:cache or route:cache going forward — keeps app always reading fresh files, no stale-cache risk.

## Backend service restart (run all three together)
```
sudo systemctl restart sk-eas-backend
sudo systemctl restart sk-eas-queue-notifications
sudo systemctl restart sk-eas-queue-ocr
```

## Troubleshooting: OCR taking 5+ minutes or failing (School ID, Voter's Cert)

**Symptom:** OCR on documents like School ID and Voter's Certificate takes
5+ minutes and sometimes fails outright, even though `ocr-service` itself
looks healthy.

**Cause:** a second `sk-eas-queue-ocr` instance (e.g. `sk-eas-queue-ocr@1`)
running alongside the main one. `ocr-service` runs with only **1** gunicorn
worker (see the worker-count note above) — it can only process one OCR
request at a time. Two queue worker instances both pulling OCR jobs means
two jobs get sent to that single worker at once; the second one sits
blocked behind the first, and Laravel's job timeout can trip before it
ever gets processed, which is where the failures came from.

**Fix — stop and disable the extra instance:**

```bash
sudo systemctl stop sk-eas-queue-ocr@1.service
sudo systemctl disable sk-eas-queue-ocr@1.service
```

This confirmed instantly fixed the slowness/failures in practice. Check
what's actually running before assuming `@1` is the extra one:

```bash
systemctl list-units 'sk-eas-queue-ocr*'
```

Only one `sk-eas-queue-ocr` instance should be enabled/running unless
`ocr-service` itself is also scaled up to more than 1 worker to match.

---

## If you ever edit a `.service` file directly (worker count, flags, etc.)
## Only if you edit a .service file itself (not app code)
```
sudo nano /etc/systemd/system/<name>.service
sudo systemctl daemon-reload
sudo systemctl restart <name>
```
daemon-reload needed — systemd caches old file, plain restart won't see edit.

## storage:link
One-time setup only, already confirmed existing on this server. Check anytime:
```
ls -la public/storage
```

## Service reference (restart commands)
```
sudo systemctl restart sk-eas-backend
sudo systemctl restart sk-eas-queue-notifications
sudo systemctl restart sk-eas-queue-ocr
sudo systemctl restart ocr-service
sudo systemctl restart face-service
```
Frontend has no restart — rebuild only.
