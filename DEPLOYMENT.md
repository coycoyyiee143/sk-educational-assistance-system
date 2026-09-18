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
