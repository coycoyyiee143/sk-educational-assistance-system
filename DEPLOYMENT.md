# Deployment — SK-EAS Ubuntu Server

Full walkthrough for deploying a change to the actual server, start to
finish. Confirmed against the real running setup (systemd + gunicorn),
not assumed from `README.md`, which only covers local dev.

---

## 1. SSH into the server

```bash
ssh skadmin@<server-ip-or-hostname>
```

## 2. Go to the repo

```bash
cd /var/www/sk-educational-assistance-system
```

## 3. Check out the branch you're deploying

```bash
git checkout <branch-name>
```

(e.g. `develop` for a normal deploy, or a feature branch if you're
testing before merging.)

## 4. Pull the latest changes

```bash
git pull
```

## 5. Database — pick ONE of these two paths

**Path A — keep existing data (normal deploys, real applicant data on the server):**

```bash
cd backend
php artisan migrate
```

**Path B — wipe and reset (testing only — never on real applicant data):**

```bash
cd backend
php artisan migrate:fresh
```

Then, only after `migrate:fresh` (a fresh database has no users at all):

```bash
php artisan tinker
```

Paste this in as one block, then press Enter to run it:

```php
$user = User::create([
    'first_name' => 'Super Admin',
    'last_name'  => 'Test',
    'email'      => 'myemail@gmail.com',
    'role'       => 'sk_admin',
    'password'   => Hash::make('mypassw0rd'),
    'is_active'  => true,
]);
```

Press Enter again, then:

```php
$user->forceFill(['email_verified_at' => now()]);
$user->save();
```

Press Enter, then exit tinker:

```php
exit
```

Add any verifier accounts through the website itself afterward (not tinker).

---

## 6. Now deploy whatever actually changed

Still in the repo, run only the row(s) below that match what changed
in this pull — skip the rest.

| You changed | Run this |
|---|---|
| Frontend (React) | `cd frontend && npm run build` — then hard-refresh the browser (Ctrl+Shift+R). No service restart needed. |
| Backend (Laravel) — any PHP file, including Jobs/Services | `cd backend && composer install --no-dev` <br> then `php artisan config:clear` <br> then `sudo systemctl restart sk-eas-backend` <br> then `sudo systemctl restart sk-eas-queue-notifications` <br> then `sudo systemctl restart sk-eas-queue-ocr` |
| OCR service (Python) | `cd ocr-service && source venv/bin/activate` <br> then `pip install -r requirements.txt` <br> then `deactivate` <br> then `sudo systemctl restart ocr-service` |
| Face service (Python) | `cd face-service && source venv/bin/activate` <br> then `pip install -r requirements.txt` <br> then `deactivate` <br> then `sudo systemctl restart face-service` |

**Why all three Laravel services for any backend change, not just
`sk-eas-backend`:** the two queue workers keep the old code loaded in
memory until restarted, even after `git pull` — a `Job` or `Service`
class change (like `ProcessOcrDocument.php` or
`DocumentReuploadRoutingService.php`) silently keeps running the OLD
version otherwise, with no error to tell you it's stale. Restarting
only `sk-eas-backend` and skipping the queue workers is the single
easiest way to think a fix is deployed when it isn't.

`pip install -r requirements.txt` is safe to run even if nothing
actually changed in that file (pip skips already-satisfied packages)
— most necessary when a Python file introduced a new import, harmless
otherwise as a default habit.

---

## Confirmed process setup (for reference)

| Component | How it runs | Restart command |
|---|---|---|
| Laravel backend (web) | systemd | `sudo systemctl restart sk-eas-backend` |
| Laravel queue — notifications | systemd | `sudo systemctl restart sk-eas-queue-notifications` |
| Laravel queue — OCR | systemd | `sudo systemctl restart sk-eas-queue-ocr` |
| OCR service (Flask + PaddleOCR) | systemd → gunicorn, `-w 1`, `--max-requests 50 --max-requests-jitter 10`, port 5000 | `sudo systemctl restart ocr-service` |
| Face service (Flask) | systemd → gunicorn, `-w 2`, port 5001 | `sudo systemctl restart face-service` |
| Frontend (React) | static build, served by nginx (not a running process) | no restart — rebuild instead (see table above) |

**Note on worker counts:** `ocr-service` runs with only 1 gunicorn
worker plus a request-recycling flag (`--max-requests`), which
`face-service` (2 workers, no recycling) doesn't have. This looks like
it was tuned for PaddleOCR's known tendency to grow memory usage over
repeated calls, not a hard memory-capacity ceiling — real measured RSS
for OCR's single worker (~382MB) was comparable to face-service's
heavier worker (~388MB), so "OCR needs fewer workers because it's
bigger" isn't obviously true from what was actually measured running.
Before increasing to `-w 2`, check `free -h`'s `available` column has
comfortable headroom beyond the extra ~400MB a second worker would
cost. Also note the unit file's `MemoryMax=4G` — a hard cgroup limit
that kills the service if exceeded; not a concern at `-w 2` (~764MB
total), but worth remembering if worker count is ever pushed much
higher later.

---

## If you ever edit a `.service` file directly (worker count, flags, etc.)

This is a DIFFERENT kind of change from the routine code deploys
above — you're editing systemd's own definition of how the process
starts, not the application code it runs. This needs one extra step
the routine table above doesn't:

```bash
sudo nano /etc/systemd/system/ocr-service.service
# make your edit, save, exit
sudo systemctl daemon-reload
sudo systemctl restart ocr-service
```

`daemon-reload` is required whenever the unit file itself changes —
systemd caches the old definition in memory and won't notice an edited
file until told to re-read it. A plain `restart` alone will keep
using the OLD unit file's settings, silently. This step is NOT needed
for the routine deploys above, since those only change application
code and restart the (unchanged) existing unit — only an edit to the
`.service` file itself needs it.