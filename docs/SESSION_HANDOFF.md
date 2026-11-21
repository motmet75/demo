# Session handoff: anhmedia.vn server and projects

Last updated: 2026-11-21. Branch: `feature/portal-web-routes` (pushed to origin). Latest commit before this file: `3dd8dca`.

Use this file to start a new Claude Code session on another machine. Say something like: *"Read docs/SESSION_HANDOFF.md first."*

> This file contains no passwords or tokens. Secrets live only on the server, in `/etc/tuonghoa/*.env` and `/opt/tuonghoa/secrets/`. Never print them, and never print the tenant `.properties` files, because they hold DB passwords.

---

## 1. Standing rules (from the user)

1. **Always stop the legacy portal jar (8080) before building anything on the server.** The server has 3.8 GiB RAM and no swap, and a build on top of the running apps makes it hang. Restart it afterwards with `/opt/tuonghoa/portal/start-portal-8080.sh`. **Better: build locally** (mvn and npm on your own machine) and upload the artifacts.
2. "Make sure combine no error": lint, build and test before you deploy.
3. Never run `git reset --hard` or `git clean -fd` in the server checkouts. The server checkout has modified React build files that must be kept.
4. Never `pkill -f <jar>` over SSH, because the pattern also matches the SSH command and kills your own session. Find the PID with `ss -ltnp | grep :<port>` and use `kill <pid>`.
5. Never deploy over a running JAR. Copy each release to a new file name.
6. Do not use or redirect to `/app/**` (the old Vaadin admin). Login is at **`/dang-nhap`** (username/password or Google).
7. Never print token values from `tokentb`.

## 2. Server

- SSH: `ssh -i <path-to>/anhmediaAug2026.pem admin@anhmedia.vn`. On the original machine the key is `L:\anhmediaAug2026.pem`; copy it to the new machine yourself, it is not in git.
- No systemd units for the Java apps. Each one is started with its own script using nohup.
- Disk is 32 GB, so keep it clean. Rollback copies are in `demo/target`, `~/demo-rollback`, `portal-web/releases/` and `demo-releases/`.

| Port | App | How it is started | Notes |
|---|---|---|---|
| 8080 | Legacy portal (`/opt/tuonghoa/portal/target/portal-th-1.0-SNAPSHOT.jar`) | `/opt/tuonghoa/portal/start-portal-8080.sh` | **Must stay running.** Login POST `/api/login-act`, cart, OAuth, `/file/`, `/doc/`, plus the social-post scheduler (AppScheduleDispatcher, every minute). |
| 8081 | Demo API (Spring Boot) | `/opt/tuonghoa/demo-releases/deploy-demo-<sha>.sh` (auto-rollback) | Live: `demo-releases/demo-80fa007.jar`. cwd `/opt/tuonghoa/demo`, env snapshot `/opt/tuonghoa/secrets/demo-8081.env`, arg `--spring.config.additional-location=file:/opt/tuonghoa/demo/src/main/resources/application.properties`. |
| 8083 | Portal Web (read-only port of legacy public site) | `/opt/tuonghoa/portal-web/start-portal-web-8083.sh [jar]` | Live: `releases/portal-web-20261121-login3.jar`. DB role `portal_web_ro` (SELECT only, connection limit 60). |
| 8093 | Portal Web staging | `start-staging-8093.sh [jar]` | **Kill it after tests.** Running it alongside 8083 uses up DB connections. |
| 8443 | Nginx | `tuonghoa.portalweb`, snippet `/etc/nginx/snippets/portal-web-first.conf` | GET goes to 8083 first and falls back to 8080 on 404/5xx. Non-GET goes to 8080. |

The demo React frontend is static, served by nginx from `/var/www/html/bom-inventory` at URL base `/bom-inventory/`.

## 3. Repos and how to deploy

The repo root (`demo-split`) holds the Demo backend (`src/`), the frontend (`bom-frontend/`) and Portal Web (`portal-web/`). They share one git repo and one branch.

**Demo backend (8081):**
1. Locally: `mvn -DskipTests package`.
2. Upload the jar as `demo-releases/demo-<sha>.jar`.
3. Copy the previous `deploy-demo-*.sh` and run it (it rolls back on a failed health check).
4. SQL migrations are applied by hand and are idempotent (there is no Flyway). Pipe a local `.sql` file into `psql`; dry-run it inside `BEGIN … ROLLBACK` first.

**Demo frontend:**
1. In `bom-frontend`, run `npm ci` (first time), then `npm run lint`, then `npm run build`.
2. Tar `dist` and untar it over `/var/www/html/bom-inventory`.
3. Back up `index.html` first to `demo-releases/bom-index.html.bak-<tag>`.
4. On Windows, `tar` needs `--force-local`.

**Portal Web (8083):**
1. In `portal-web`, run `mvn -DskipTests package`.
2. Upload the jar to `portal-web/releases/portal-web-<date>-<name>.jar`.
3. Test it on staging 8093, then restart 8083 with the new jar.
4. Check parity against legacy: `python3 -I /opt/tuonghoa/portal-web/parity.py <port> <maxUrls>`. URL list: `/opt/tuonghoa/portal-web/all-urls.txt`.

## 4. What was done on 2026-11-21

**Portal Web:**
- `/dang-nhap` now works for all tenants. Tenants without their own `login-page.html` get a shared page, `templates/portal-web-shared/login-page.html`, with username/password and Google login (`e32a922`).
- `LegacySite.templateExists` now also checks the live templates in `/opt/portal-live/templates`.
- The connection limit for `portal_web_ro` was raised from 20 to 60.

**Speed check:** hit directly, 8083 is much faster than 8080 (15 s against 712 s over 260 pages). Pages that feel slow are probably the ones not yet ported, which make the 8083 → 404 → 8080 double hop.

**Demo admin, "Website" content for tenants (`9159cd8`, `80fa007`, `4e5e258`, `3dd8dca`):**
- Page `/bom-inventory/admin/portal-content?tab=products|articles|media`.
- Admin menu: a group **📰 Website** at the top, open by default, with Đăng sản phẩm, Lịch đăng mạng xã hội and Đăng bài viết.
- Tabs: Articles, Products, **Media schedule**.
  - "New" copies the category and catalog fields from the newest item.
  - The path auto-fills as `<code>.html`.
  - Dialogs are full-screen on phones.
- Media schedule (`PortalScheduleService.java`):
  - Writes `schedulelogtb` and `appscheduletb` rows exactly as the legacy form does. The legacy 8080 dispatcher then posts them.
  - Actions: `post_facebook_multi_image`, `post_facebook_video`, `post_youtube_video`, `post_tiktok_video`, `post_tiktok_image`.
  - Facebook pages come from `tokentb` (`facebook_page_access_token`). Tokens are never returned to the browser.
  - Times are entered in Vietnam time and stored in UTC.
- Endpoints, under PortalContentAdminController:
  - `GET /{tenantId}/schedules`
  - `GET /{tenantId}/facebook-pages`
  - `POST /{tenantId}/schedules`
  - `POST /{tenantId}/schedules/{id}/cancel`
- Access: a tenant admin sees a website only when `tenant.portal_content_tenant` is set. It is set for the NNC Minh Châu tenant → `nncminhchau.vn` (demo user `nncminhchau`, ROLE_ADMIN). That user has two Facebook pages: "NNC" and "NNC Tan Buu".

**Demo mobile / home-screen app (`91a5193`):**
- A floating Home button (`src/components/StaffHomeButton.jsx`) on `/shop/counter`, `/shop/board` and `/shop/customer-board`. It returns to the last staff screen, which is stored in localStorage `bom.lastView` (`src/components/lastView.js`).
- The layout uses `100dvh`, so the iPhone sidebar is no longer cut off.

## 5. Open items and ideas

- **Not tested yet:** creating a media schedule end-to-end while logged in as `nncminhchau`. I had no password for that account. Ask the user to try it, then check the `schedulelogtb` status (pending → fired or failed).
- Offered to the user but not requested yet:
  - Photo upload (to Google Drive) from the demo forms. Right now images are pasted as URLs.
  - Auto-collapse the sidebar on phones.
- Portal Web has not ported the cart, OAuth, `/file/`, `/doc/`, `/demo/**` or the login POST, so 8080 must keep running.
- Security: `/opt/tuonghoa/database-backup/tuonghoadb.sh` contains the postgres password in plain text. Rotate that password and switch the script to `~/.pgpass`.
- The local worktree has uncommitted changes under `bom-frontend/dist/`. They are build output; do not commit them.
