import type { DashboardConfig } from "../types.js";
import { loadSecretSettings } from "./secrets.js";

interface TransferInfo {
  dl_info_speed?: number;
  up_info_speed?: number;
  dl_info_data?: number;
  up_info_data?: number;
}

interface TorrentInfo {
  name?: string;
  progress?: number;
  state?: string;
  dlspeed?: number;
  upspeed?: number;
  eta?: number;
}

interface SessionCacheEntry {
  cookie: string;
  expiresAt: number;
}

const sessionCache = new Map<string, SessionCacheEntry>();
const sessionTtlMs = 10 * 60 * 1000;

function baseUrl(config: DashboardConfig) {
  return config.integrations?.qbittorrent?.baseUrl?.replace(/\/+$/, "");
}

function bytesPerSecondToMbps(value?: number) {
  return Number((((value ?? 0) * 8) / 1_000_000).toFixed(1));
}

function bytesToGb(value?: number) {
  return Number(((value ?? 0) / 1_000_000_000).toFixed(1));
}

function countByState(torrents: TorrentInfo[]) {
  return torrents.reduce(
    (counts, torrent) => {
      const state = (torrent.state ?? "").toLowerCase();

      if (state.includes("error") || state.includes("missing")) {
        counts.errored += 1;
      } else if (state.includes("paused") || state.includes("stalled")) {
        counts.paused += 1;
      } else if (state.includes("upload") || state.includes("seed")) {
        counts.seeding += 1;
      } else if (state.includes("downloading") || state.includes("meta") || state.includes("checking")) {
        counts.downloading += 1;
      }

      return counts;
    },
    { downloading: 0, seeding: 0, paused: 0, errored: 0 }
  );
}

function isActive(torrent: TorrentInfo) {
  return (torrent.dlspeed ?? 0) > 0 || (torrent.upspeed ?? 0) > 0 || !["pauseddl", "pausedup"].includes((torrent.state ?? "").toLowerCase());
}

function qbitSettings(config: DashboardConfig) {
  const settings = config.integrations?.qbittorrent;
  const torrentLimit = Math.min(10, Math.max(0, Math.round(Number(settings?.torrentLimit ?? 5))));

  return {
    showNames: settings?.showNames === true,
    torrentLimit: Number.isFinite(torrentLimit) ? torrentLimit : 5,
    speedUnit: settings?.speedUnit === "mbs" ? "mbs" : "mbps"
  };
}

async function qbitFetch(base: string, path: string, cookie: string) {
  const response = await fetch(`${base}${path}`, {
    headers: {
      Accept: "application/json",
      Cookie: cookie,
      Referer: `${base}/`
    },
    signal: AbortSignal.timeout(15_000)
  });

  if (!response.ok) {
    throw new Error(`qBittorrent returned ${response.status}`);
  }

  return response;
}

async function login(base: string, username: string, password: string) {
  const cacheKey = `${base}|${username}`;
  const cached = sessionCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.cookie;
  }

  const response = await fetch(`${base}/api/v2/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: base,
      Referer: `${base}/`
    },
    body: new URLSearchParams({ username, password }),
    signal: AbortSignal.timeout(15_000)
  });

  const body = (await response.text()).trim();
  const cookie = response.headers.get("set-cookie")?.split(";")[0];

  if (!response.ok || (body && body !== "Ok.") || (!body && !cookie)) {
    throw new Error("qBittorrent login failed");
  }

  if (!cookie) {
    throw new Error("qBittorrent did not return a session cookie");
  }

  sessionCache.set(cacheKey, {
    cookie,
    expiresAt: Date.now() + sessionTtlMs
  });

  return cookie;
}

function clearLogin(base: string, username: string) {
  sessionCache.delete(`${base}|${username}`);
}

export async function getQBittorrentWidgetData(config: DashboardConfig) {
  const url = baseUrl(config);
  const settings = qbitSettings(config);

  if (!url) {
    return {
      status: "unknown" as const,
      configured: false,
      downloadMbps: 0,
      uploadMbps: 0,
      totalDownloadedGb: 0,
      totalUploadedGb: 0,
      total: 0,
      downloading: 0,
      seeding: 0,
      paused: 0,
      errored: 0,
      torrents: [],
      settings,
      error: "qBittorrent is not configured"
    };
  }

  const secrets = await loadSecretSettings();
  const username = secrets.qbittorrent?.username;
  const password = secrets.qbittorrent?.password;

  if (!username || !password) {
    return {
      status: "unknown" as const,
      configured: false,
      downloadMbps: 0,
      uploadMbps: 0,
      totalDownloadedGb: 0,
      totalUploadedGb: 0,
      total: 0,
      downloading: 0,
      seeding: 0,
      paused: 0,
      errored: 0,
      torrents: [],
      settings,
      error: "qBittorrent credentials are not configured"
    };
  }

  try {
    let cookie = await login(url, username, password);
    let transferResponse: Response;
    let torrentsResponse: Response;

    try {
      [transferResponse, torrentsResponse] = await Promise.all([
        qbitFetch(url, "/api/v2/transfer/info", cookie),
        qbitFetch(url, "/api/v2/torrents/info?sort=last_activity&reverse=true", cookie)
      ]);
    } catch (error) {
      clearLogin(url, username);
      cookie = await login(url, username, password);
      [transferResponse, torrentsResponse] = await Promise.all([
        qbitFetch(url, "/api/v2/transfer/info", cookie),
        qbitFetch(url, "/api/v2/torrents/info?sort=last_activity&reverse=true", cookie)
      ]);
    }

    const transfer = (await transferResponse.json()) as TransferInfo;
    const torrents = (await torrentsResponse.json()) as TorrentInfo[];
    const counts = countByState(torrents);

    return {
      status: "online" as const,
      configured: true,
      downloadMbps: bytesPerSecondToMbps(transfer.dl_info_speed),
      uploadMbps: bytesPerSecondToMbps(transfer.up_info_speed),
      totalDownloadedGb: bytesToGb(transfer.dl_info_data),
      totalUploadedGb: bytesToGb(transfer.up_info_data),
      total: torrents.length,
      ...counts,
      settings,
      torrents: torrents
        .filter(isActive)
        .slice(0, settings.torrentLimit)
        .map((torrent, index) => ({
          name: settings.showNames ? torrent.name ?? "Unnamed torrent" : `Torrent ${index + 1}`,
          progress: Math.round((torrent.progress ?? 0) * 1000) / 10,
          state: torrent.state ?? "unknown",
          downloadMbps: bytesPerSecondToMbps(torrent.dlspeed),
          uploadMbps: bytesPerSecondToMbps(torrent.upspeed),
          etaSeconds: torrent.eta && torrent.eta > 0 && torrent.eta < 8_640_000 ? torrent.eta : null
        }))
    };
  } catch (error) {
    return {
      status: "offline" as const,
      configured: true,
      downloadMbps: 0,
      uploadMbps: 0,
      totalDownloadedGb: 0,
      totalUploadedGb: 0,
      total: 0,
      downloading: 0,
      seeding: 0,
      paused: 0,
      errored: 0,
      torrents: [],
      settings,
      error: error instanceof Error ? error.message : "qBittorrent request failed"
    };
  }
}
