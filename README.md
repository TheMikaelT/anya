# Anya

Anya is a self-hosted homelab dashboard inspired by Heimdall, with configurable link cards, RSS feeds and live widgets for homelab integrations.

## Features

- React + TypeScript + Vite frontend
- Tailwind CSS dark dashboard UI
- Node.js + Express + TypeScript backend
- JSON config in local `config/dashboard.json`
- Link search by name, description and category
- Category-grouped service cards
- Add, edit and delete services from the dashboard
- Service templates for common homelab apps
- Refreshable icon library from public icon catalogs
- Per-service online/offline status checks
- Docker container discovery
- Heimdall import from an existing Heimdall SQLite database
- RSS feed widget with UI-managed feeds and per-feed error handling
- Docker widget backed by the local Docker socket
- UI configuration for Docker, Plex, UniFi, qBittorrent and Ollama
- Health Overview command-center widget for whole homelab status
- Notification Center that only surfaces warnings and problems
- Dashboard mood background that follows overall health
- Appearance settings with preset backgrounds and local image uploads
- Private data foundation with local SQLite migrations
- Backup Status widget for local config and private data backups
- Private Notes widget with local SQLite storage
- Private Journal widget with dated entries and optional mood
- Today widget that summarizes notes, journal and backup status
- Private Tasks widget with tasks and reminders
- Mail / IMAP widget for a read-only inbox glance with optional unread alerts
- Notification history and acknowledgement stored in local SQLite
- PWA install support for mobile home-screen use
- Command Palette with `Ctrl + K` / `Cmd + K`
- Ollama Quick Ask widget with an animated response pulse
- UI widget reordering
- Mock UniFi and Plex widgets until credentials are configured
- Docker Compose support

## Run with Docker Compose

```bash
cd anya
docker compose up --build
```

Open:

- Dashboard: http://localhost:8088
- API through the dashboard origin: http://localhost:8088/api

The backend runs inside the Docker network on port `3001`. The frontend nginx container proxies `/api` to it, so the app works through port `8088` even when host port `3001` is already used by another service. To use another host port, set `ANYA_PORT`:

```bash
ANYA_PORT=8090 docker compose up --build
```

Optional: copy `.env.example` to `.env` and edit the values before starting:

```bash
cp .env.example .env
docker compose up --build
```

The backend container mounts `./config` at `/app/config`, so edits made through the dashboard are persisted. Public settings go to `config/dashboard.json`; secrets entered in the UI go to local `config/secrets.json`. The generated icon cache is stored in `config/icon-catalog.json`.

`config/dashboard.json` is intentionally git-ignored because it can contain real local hostnames and service URLs. On a fresh checkout, Anya falls back to `config/dashboard.example.json`; the first dashboard save creates your local `config/dashboard.json`.

Private productivity data is stored under `config/data/` and local backup copies are stored under `config/backups/` unless `PRIVATE_DB_PATH` or `BACKUP_PATH` are set. These folders are git-ignored and are intended for your private Anya instance, not for a public release.

Docker discovery uses `/var/run/docker.sock` and the backend is added to the host Docker group with `DOCKER_GID`:

```bash
DOCKER_GID=$(getent group docker | cut -d: -f3) docker-compose up --build -d
```

The default compose file also mounts Heimdall from `/opt/heimdall/config/www` read-only. If your Heimdall config lives elsewhere, update the `HEIMDALL_DB_PATH` environment variable and the matching volume.

## Install from GitHub

After publishing the repository, a fresh Docker install should look like this:

```bash
git clone https://github.com/YOUR-USER/anya.git
cd anya
cp .env.example .env
docker compose up --build
```

For a second test instance on the same host, use another port:

```bash
ANYA_PORT=8093 docker compose up --build
```

The first run should start with no configured services, no RSS feeds and no enabled widgets. Add services from the UI and verify that `config/dashboard.json` and `config/secrets.json` are created locally but remain ignored by git.

## Run locally

Install backend dependencies and start the API:

```bash
cd anya/backend
npm install
npm run dev
```

In another terminal, install frontend dependencies and start Vite:

```bash
cd anya/frontend
npm install
npm run dev
```

Open http://localhost:8088. The Vite dev server proxies `/api` requests to `http://localhost:3001`.

## API

- `GET /api/links` returns dashboard title, links and enabled widgets.
- `POST /api/links` adds a service link to `config/dashboard.json`.
- `PUT /api/links/:id` updates a service link.
- `DELETE /api/links/:id` removes a service link.
- `GET /api/templates` returns service templates used by the add-service form.
- `GET /api/icons` returns the cached icon library.
- `POST /api/icons/refresh` refreshes the public icon library cache.
- `POST /api/services/refresh-library` refreshes icons and simple metadata for existing services.
- `GET /api/status` checks configured service URLs.
- `GET /api/integrations` returns integration status and non-secret settings.
- `PUT /api/integrations` saves integration settings from the UI. Secrets are written to local `config/secrets.json`.
- `PUT /api/widgets/order` saves the right-rail widget order.
- `GET /api/discover/docker` previews Docker service suggestions.
- `POST /api/discover/docker/import` imports Docker service suggestions and skips existing URLs.
- `GET /api/import/heimdall/preview` previews services from Heimdall.
- `POST /api/import/heimdall` imports Heimdall services and skips existing URLs.
- `GET /api/rss` fetches the latest configured RSS items. Feed failures are returned per feed and do not crash the backend.
- `GET /api/rss/feeds` returns configured RSS feed sources.
- `PUT /api/rss/feeds` saves RSS feed sources from the UI.
- `GET /api/health/overview` returns the overall homelab health summary.
- `GET /api/notifications` returns warning and error notifications derived from widget health.
- `GET /api/mail` returns read-only IMAP inbox summaries when Mail is configured.
- `GET /api/notifications/history` returns recent notification history from local SQLite.
- `POST /api/notifications/:id/ack` acknowledges one notification.
- `POST /api/notifications/ack-all` acknowledges all open notifications.
- `GET /api/backup` returns private backup status and recent backup runs.
- `POST /api/backup/run` creates a local backup of Anya config and private data. It does not execute shell commands.
- `POST /api/backup/verify` checks that the latest backup contains the expected files and a readable private SQLite database. It does not restore or overwrite anything.
- `GET /api/notes` returns private notes from local SQLite.
- `POST /api/notes` creates a private note.
- `PUT /api/notes/:id` updates a private note.
- `DELETE /api/notes/:id` deletes a private note.
- `GET /api/journal` returns private journal entries from local SQLite.
- `POST /api/journal` creates a private journal entry.
- `PUT /api/journal/:id` updates a private journal entry.
- `DELETE /api/journal/:id` deletes a private journal entry.
- `GET /api/today` returns a daily private overview from notes, journal and backup status.
- `GET /api/tasks` returns private tasks from local SQLite.
- `POST /api/tasks` creates a private task.
- `PUT /api/tasks/:id` updates a private task.
- `DELETE /api/tasks/:id` deletes a private task.
- `GET /api/reminders` returns private reminders from local SQLite.
- `POST /api/reminders` creates a private reminder.
- `PUT /api/reminders/:id` updates a private reminder.
- `DELETE /api/reminders/:id` deletes a private reminder.
- `GET /api/unifi` returns mock UniFi data.
- `GET /api/plex` returns mock Plex data.
- `GET /api/docker` returns live Docker data when the Docker socket is mounted.
- `GET /api/qbittorrent` returns live qBittorrent Web UI data when configured.
- `GET /api/ollama` returns Ollama connection status and model names.
- `POST /api/ollama/ask` sends the current in-browser chat context to Ollama through the backend.

## Configuration

Most configuration is available in the UI through `Manage`.

The committed `config/dashboard.example.json` contains safe example values. Keep your real local configuration in the ignored `config/dashboard.json`:

```json
{
  "title": "Anya",
  "links": [],
  "rssFeeds": [],
  "widgets": {
    "rss": false,
    "rssTicker": false,
    "plex": false,
    "unifi": false,
    "docker": false,
    "qbittorrent": false,
    "ollama": false,
    "assistant": false,
    "mail": false
  },
  "widgetOrder": ["unifi", "plex", "docker", "qbittorrent", "ollama", "rss", "mail"],
  "widgetLayout": "sidebar",
  "widgetStyle": "cards",
  "integrations": {
    "docker": {
      "socketPath": "/var/run/docker.sock"
    },
    "plex": {
      "baseUrl": ""
    },
    "unifi": {
      "baseUrl": "",
      "site": "default"
    },
    "ollama": {
      "baseUrl": "",
      "model": ""
    },
    "qbittorrent": {
      "baseUrl": "",
      "showNames": false,
      "torrentLimit": 5,
      "speedUnit": "mbps"
    },
    "mail": {
      "providerName": "Mail",
      "host": "",
      "port": 993,
      "secure": true,
      "username": "",
      "mailbox": "INBOX",
      "maxItems": 8,
      "unreadAlertThreshold": 0,
      "openUrl": ""
    }
  }
}
```

## Integrations and secrets

Keep real hostnames, tokens, usernames and passwords out of the repository.

- Configure Plex, UniFi and qBittorrent from `Manage -> Integrations`.
- The UI stores tokens and passwords in local `config/secrets.json`.
- `config/dashboard.json` is ignored by git because it may contain private local URLs, hostnames and widget choices.
- `config/secrets.json` is ignored by git and should not be committed.
- `config/icon-catalog.json` is a generated cache of public icon URLs and is ignored by git.
- `config/uploads/` stores local uploaded backgrounds and is ignored by git.
- `config/data/` stores private SQLite data for personal Anya features and is ignored by git.
- `config/backups/` stores local backup snapshots and is ignored by git.

This public edition intentionally excludes private runtime configuration, secrets, uploaded backgrounds, local SQLite data, backup snapshots and private-only stream proxy experiments.

## Private data and backups

The private branch of Anya uses a local SQLite database for personal features such as notes, journal entries, reminders, notification history, push subscriptions, assistant sessions and backup runs. The database is created automatically at `config/data/anya-private.sqlite`.

The Notes widget stores private notes locally in SQLite. Notes can be searched, pinned, edited and deleted from the widget. They are included in private database backups and are not part of the public snapshot.

The Journal widget stores dated private entries locally in SQLite. Entries can include an optional mood, can be searched, edited and deleted, and are included in private database backups.

The Tasks widget stores private tasks and reminders locally in SQLite. Tasks can be marked done/open, reminders can be marked done/scheduled, and both are included in private database backups.

The Today widget is a read-only daily overview that combines today's journal entries, useful notes, open tasks, reminders and backup status into one command-center card.

Notification Center stores notification events in local SQLite. Acknowledged notifications stay acknowledged across browsers and devices, and resolved notifications remain available in history. This is the foundation for future iOS/PWA push notifications.

Use the Backup widget to create a local backup of:

- `config/dashboard.json`
- `config/secrets.json`
- `config/templates.json`
- `config/data/anya-private.sqlite`
- uploaded background images

Set `BACKUP_PATH` to point at a mounted folder, such as a NAS backup mount, when you are ready to move backups off the Anya host. The Backup widget checks whether this target is writable and can verify the latest backup without restoring it. Keep these backups private because they may contain local URLs and secrets.

With Docker Compose, keep the default local backup target or mount an external folder:

```bash
ANYA_BACKUP_HOST_PATH=/mnt/backups/anya \
ANYA_BACKUP_PATH=/app/external-backups \
docker compose up -d
```

When `ANYA_BACKUP_PATH` points outside `/app/config/backups`, the widget labels the target as external.

## Security notes

Anya is designed for a trusted self-hosted LAN. It does not implement authentication yet. Do not expose the frontend or backend directly to the public internet unless you put it behind a trusted reverse proxy with authentication and TLS.

The backend can call user-configured internal services such as RSS feeds, Plex, UniFi, Docker Socket Proxy, Home Assistant and Ollama. Treat access to the Anya UI/API as trusted administrator access.

Recommended deployment: run Anya only on your LAN or behind your own VPN. Anya intentionally does not expose destructive backend actions, does not execute arbitrary shell commands and does not send stored tokens or passwords to the frontend. Secrets entered through the UI stay in local `config/secrets.json`, which is ignored by git.

### Command center

The dashboard top area is meant for fast situational awareness:

- RSS ticker for headlines.
- Search bar for web/search-engine queries.
- Health Overview for Internet, UniFi, Docker, Plex, qBittorrent, Home Assistant, Ollama, VPN, RSS and future Backups/SSL/UPS checks.
- Notification Center for warnings and errors only. If nothing needs attention, it shows `Everything healthy`.

The background glow subtly changes with overall health:

- `healthy`: calm blue/green.
- `warning`: amber accent.
- `error`: muted red accent.
- `unknown`: neutral gray/blue.

Open `Manage -> Appearance` to choose a preset background, upload a local JPG/PNG/WebP image, or return to the default Anya glow. Uploaded backgrounds are stored locally under `config/uploads/` and are not meant to be committed.

Open the Command Palette with `Ctrl + K` or `Cmd + K`. Initial commands open configured services, refresh widgets and open settings. Future quick actions such as Docker logs, Plex library scan or Home Assistant reload should remain safe and explicit; do not add restart/delete/pause actions without authentication and confirmations.

### PWA / mobile install

Anya includes a web app manifest and a lightweight service worker so it can be added to a phone home screen. The service worker caches only the app shell and static assets; it intentionally does not cache `/api`, uploaded private files or stream routes. On iOS standalone mode, Anya shows a small reload button for recovery if the app view gets stuck.

Service workers require HTTPS, except on `localhost`. Use Anya only on your LAN or behind your own VPN. Web Push notifications are not enabled yet.

### Service icons

Anya can refresh a public icon catalog from selfh.st/icons and Dashboard Icons. Use `Manage -> Library` to refresh the catalog and fill missing icons for existing services. In the add/edit service modal, use `Refresh icon library` when you need the latest icon list.

### RSS feeds

Open `Manage -> RSS`, add a feed name and RSS URL, then save. Anya stores the feed list in `config/dashboard.json`; failed feeds show an error in the widget without crashing the backend.

### Docker widget

The Docker widget is formed from one or more Docker Engine sources. Configure them from `Manage -> Integrations -> Docker`.

- Use `Local socket` for the Docker host that runs Anya.
- Use `Socket proxy` for another Docker host on your LAN.
- Do not expose the raw Docker API to the internet. Prefer a read-only Docker Socket Proxy.

Example Docker Socket Proxy on another host:

```yaml
services:
  docker-socket-proxy:
    image: tecnativa/docker-socket-proxy
    environment:
      CONTAINERS: 1
      IMAGES: 1
      SYSTEM: 1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - "2375:2375"
```

Then add `http://that-docker-host:2375` as a Socket proxy source in Anya.

For each configured source:

- `running` and `stopped` come from `/containers/json?all=1`.
- `containers` shows the first running non-Anya containers.
- `images` comes from `/images/json`.
- `volumeUsageGb` comes from `/system/df` when available.
- `cpuPercent` and RAM values come from per-container `/containers/:id/stats?stream=false`.

If the socket is not mounted or permissions are wrong, the widget shows an unknown state and setup guidance is available from the dashboard's Integrations view.

### Plex widget

Open `Manage -> Integrations`, enter the Plex base URL and token, then save. The token is stored only in local `config/secrets.json`.

### UniFi widget

Open `Manage -> Integrations`, enter the UniFi controller URL, site, username and password, then save. Credentials are stored only in local `config/secrets.json`.

### Widget order

Open `Manage -> Widgets`, move widgets up or down, choose `Sidebar` or `Center`, choose `Cards`, `Dense cards` or `Compact blend`, then save. The order is stored in `config/dashboard.json` as `widgetOrder`; the dashboard layout is stored as `widgetLayout`, and the visual style is stored as `widgetStyle`.

### Ollama widget

Open `Manage -> Integrations`, enter the Ollama base URL and a default model, then save. Anya calls Ollama through the backend and does not store prompts or responses. The Ollama widget keeps the current conversation only in the browser so follow-up questions include the previous turns; use `New chat` to clear that context.

### qBittorrent widget

Open `Manage -> Integrations`, enter the qBittorrent Web UI URL, username and password, then save. Credentials are stored only in local `config/secrets.json`. The widget is read-only and shows transfer speed, torrent counts and recent active torrents.

By default Anya hides torrent names before data is sent to the browser. In `Manage -> Integrations -> qBittorrent`, enable `Show torrent names in the widget` only if you want titles visible on the dashboard. You can also set how many active torrents are shown and choose either Mbps or MB/s for speeds.
