# Anya

Anya is a FULLY VIBE-CODED self-hosted homelab dashboard with service links, RSS feeds and live widgets for common home server tools.

This is not supposed to be a full product. It is a private dashboard project built for my own homelab, shared as-is for people who want to borrow ideas or run their own copy.

You can check my video on Anya:
https://youtu.be/rsVZqyi3BWw


## Features

- Configurable service dashboard
- Service templates and icon lookup
- RSS ticker and RSS widget
- Docker, Plex, UniFi, qBittorrent, Ollama, VPN and IMAP widgets
- Health overview and notifications
- Notes, journal, tasks and backup widgets
- Custom backgrounds
- Mobile/PWA support
- Command palette with `Ctrl + K` / `Cmd + K`
- Local JSON and SQLite storage

## Docker Install

Clone the repository:

```bash
git clone https://github.com/TheMikaelT/anya.git
cd anya
```

Create a local environment file:

```bash
cp .env.example .env
```

Start Anya:

```bash
docker compose up -d --build
```

Open:

```text
http://localhost:8088
```

To use another host port:

```bash
ANYA_PORT=8090 docker compose up -d --build
```

## Docker Install With Prebuilt Images

If the GitHub Container Registry images are public, you can run Anya without building locally:

```bash
git clone https://github.com/TheMikaelT/anya.git
cd anya
cp .env.example .env
docker compose -f docker-compose.ghcr.yml up -d
```

Images:

- `ghcr.io/themikaelt/anya-frontend:latest`
- `ghcr.io/themikaelt/anya-backend:latest`

## Updating

For a source-build install:

```bash
git pull
docker compose up -d --build
```

For a prebuilt-image install:

```bash
git pull
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

## Configuration

Configure Anya from the dashboard UI.

Local runtime files are created under `config/`:

- `config/dashboard.json` stores dashboard links, widgets and non-secret settings.
- `config/secrets.json` stores tokens and passwords.
- `config/uploads/` stores uploaded backgrounds.
- `config/data/` stores local SQLite data.
- `config/backups/` stores local backup snapshots.

These files and folders are ignored by git.

On a fresh install Anya starts from `config/dashboard.example.json`, with no personal services configured.

## Docker Access

The Docker widget uses the Docker socket when it is mounted:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

If Docker permissions fail, set the Docker group id:

```bash
DOCKER_GID=$(getent group docker | cut -d: -f3) docker compose up -d --build
```

For remote Docker hosts, use a read-only Docker Socket Proxy. Do not expose the raw Docker API to the internet.

## Backups

Anya can create local backups of dashboard config, secrets, private SQLite data and uploaded backgrounds.

To store backups on another mounted folder:

```bash
ANYA_BACKUP_HOST_PATH=/mnt/backups/anya \
ANYA_BACKUP_PATH=/app/external-backups \
docker compose up -d
```

Keep backups private because they may contain local URLs and secrets.

## Security

Anya is designed for a trusted LAN or VPN.

It does not include authentication yet. Do not expose Anya directly to the public internet.

Recommended use:

- Run it only on your LAN.
- Or place it behind your own VPN.
- Or use a trusted reverse proxy with authentication and TLS.

Anya does not intentionally expose destructive backend actions, does not execute arbitrary shell commands and does not send stored tokens or passwords to the frontend.
