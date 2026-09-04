import type { DashboardConfig, RssFeedResult } from "../types.js";
import { getServiceIntegrationData } from "./additionalIntegrations.js";
import { getDockerWidgetData, type DockerWidgetData } from "./docker.js";
import { getGluetunWidgetData, type GluetunWidgetData } from "./gluetun.js";
import { getMailWidgetData } from "./mail.js";
import { syncNotificationEvents, type NotificationEvent } from "./notificationEvents.js";
import { getOllamaInfo } from "./ollama.js";
import { getPlexWidgetData } from "./plex.js";
import { getQBittorrentWidgetData } from "./qbittorrent.js";
import { fetchRssFeeds } from "./rss.js";
import { getUnifiWidgetData } from "./unifi.js";

export type HealthStatus = "healthy" | "warning" | "error" | "unknown";

export interface HealthOverviewItem {
  name: string;
  status: HealthStatus;
  message: string;
  lastChecked: string;
}

export interface HealthOverviewResponse {
  overallStatus: HealthStatus;
  items: HealthOverviewItem[];
}

export interface NotificationItem {
  severity: "warning" | "error" | "info";
  title: string;
  message: string;
  source: string;
  createdAt: string;
}

interface HealthContext {
  overview: HealthOverviewResponse;
  notifications: NotificationItem[];
}

interface ServiceLike {
  status?: "online" | "offline" | "unknown";
  configured?: boolean;
  error?: string;
}

let cachedContext: { createdAt: number; context: HealthContext } | null = null;
let pendingContext: Promise<HealthContext> | null = null;
const cacheMs = 15_000;

function nowIso() {
  return new Date().toISOString();
}

function cleanMessage(message?: string) {
  if (!message) {
    return "Check failed";
  }

  return message.replace(/https?:\/\/\S+/gi, "configured endpoint").slice(0, 140);
}

function item(name: string, status: HealthStatus, message: string, lastChecked: string): HealthOverviewItem {
  return { name, status, message, lastChecked };
}

function fromServiceStatus(data: ServiceLike | null | undefined, healthyMessage: string) {
  if (!data) {
    return { status: "unknown" as const, message: "No data yet" };
  }

  if (data.status === "online") {
    return { status: "healthy" as const, message: healthyMessage };
  }

  if (data.status === "offline") {
    return { status: "error" as const, message: cleanMessage(data.error ?? "Offline") };
  }

  if (data.configured === false) {
    return { status: "unknown" as const, message: "Not configured" };
  }

  return { status: "unknown" as const, message: cleanMessage(data.error ?? "Unknown") };
}

async function safe<T>(work: Promise<T>): Promise<T | null> {
  try {
    return await work;
  } catch {
    return null;
  }
}

async function checkInternet() {
  const urls = [
    "https://www.google.com/generate_204",
    "https://cloudflare.com/cdn-cgi/trace",
    "https://api.ipify.org"
  ];
  const errors: string[] = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(4_000)
      });

      if (response.ok || response.status === 204) {
        return;
      }

      errors.push(`${response.status}`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "failed");
    }
  }

  throw new Error(errors[0] ?? "Internet check failed");
}

function overallStatus(items: HealthOverviewItem[]) {
  const placeholders = new Set(["Backups", "SSL", "UPS"]);
  const important = items.filter((entry) => !placeholders.has(entry.name));
  const known = important.filter((entry) => entry.status !== "unknown");

  if (known.length < Math.ceil(important.length / 2)) {
    return "unknown" as const;
  }

  if (important.some((entry) => entry.status === "error")) {
    return "error" as const;
  }

  if (important.some((entry) => entry.status === "warning")) {
    return "warning" as const;
  }

  return "healthy" as const;
}

function buildRssStatus(feeds: RssFeedResult[] | null) {
  if (!feeds) {
    return { status: "unknown" as const, message: "RSS data unavailable" };
  }

  if (!feeds.length) {
    return { status: "unknown" as const, message: "No feeds configured" };
  }

  const errors = feeds.filter((feed) => feed.error && !feed.items.length);
  const stale = feeds.filter((feed) => feed.stale || feed.error);
  const itemCount = feeds.reduce((count, feed) => count + feed.items.length, 0);

  if (errors.length === feeds.length) {
    return { status: "error" as const, message: "All RSS feeds failed" };
  }

  if (stale.length) {
    return { status: "warning" as const, message: `${stale.length} feed${stale.length === 1 ? "" : "s"} need attention` };
  }

  return { status: "healthy" as const, message: `${itemCount} recent items` };
}

function buildDockerStatus(data: DockerWidgetData | null) {
  const base = fromServiceStatus(data, data ? `${data.running} running · ${data.stopped} stopped` : "Online");

  if (!data || base.status !== "healthy") {
    return base;
  }

  if (data.sources.some((source) => source.status === "offline")) {
    return { status: "warning" as const, message: "One Docker source is offline" };
  }

  if (data.stopped > 0) {
    return { status: "warning" as const, message: `${data.stopped} stopped container${data.stopped === 1 ? "" : "s"}` };
  }

  return base;
}

function buildVpnStatus(data: GluetunWidgetData | null) {
  if (!data) {
    return { status: "unknown" as const, message: "VPN data unavailable" };
  }

  if (!data.configured) {
    return { status: "unknown" as const, message: "Not configured" };
  }

  if (data.leakDetected || !data.protected) {
    return { status: "error" as const, message: "VPN route is not protected" };
  }

  if (data.status === "online") {
    return { status: "healthy" as const, message: data.vpnIp ? `Protected via ${data.vpnIp}` : "Protected" };
  }

  if (data.status === "offline") {
    return { status: "error" as const, message: cleanMessage(data.error ?? "VPN check failed") };
  }

  return { status: "unknown" as const, message: cleanMessage(data.error ?? "Unknown") };
}

function buildHomeAssistantStatus(data: Awaited<ReturnType<typeof getServiceIntegrationData>> | null) {
  const base = fromServiceStatus(data, data ? `${data.metrics.length} metrics · ${data.controls?.length ?? 0} controls` : "Online");

  if (!data || base.status !== "healthy") {
    return base;
  }

  const unavailable = data.metrics.find((metric) => metric.label.toLowerCase() === "unavailable");
  const unavailableCount = Number(unavailable?.value ?? 0);

  if (Number.isFinite(unavailableCount) && unavailableCount > 0) {
    return { status: "warning" as const, message: `${unavailableCount} unavailable entit${unavailableCount === 1 ? "y" : "ies"}` };
  }

  return base;
}

function notificationsFromOverview(items: HealthOverviewItem[], createdAt: string) {
  const quietUnknown = new Set(["Backups", "SSL", "UPS"]);
  return items
    .filter((entry) => entry.status === "error" || entry.status === "warning")
    .filter((entry) => !(entry.name === "Docker" && entry.status === "warning"))
    .filter((entry) => !(entry.status === "unknown" && quietUnknown.has(entry.name)))
    .map((entry) => ({
      severity: entry.status === "error" ? "error" as const : "warning" as const,
      title: `${entry.name} ${entry.status === "error" ? "needs attention" : "warning"}`,
      message: entry.message,
      source: entry.name,
      createdAt
    }));
}

function extraNotifications(
  docker: DockerWidgetData | null,
  qbittorrent: Awaited<ReturnType<typeof getQBittorrentWidgetData>> | null,
  vpn: GluetunWidgetData | null,
  mail: Awaited<ReturnType<typeof getMailWidgetData>> | null,
  rss: RssFeedResult[] | null,
  createdAt: string
) {
  const items: NotificationItem[] = [];

  if (docker?.stoppedContainers.length) {
    const names = docker.stoppedContainers.slice(0, 3).map((container) => container.name).join(", ");
    items.push({
      severity: "warning",
      title: "Docker has stopped containers",
      message: `${names}${docker.stoppedContainers.length > 3 ? " and more" : ""}`,
      source: "Docker",
      createdAt
    });
  }

  if (qbittorrent?.configured && qbittorrent.status === "online" && vpn?.configured && (!vpn.protected || vpn.leakDetected || vpn.status !== "online")) {
    items.push({
      severity: vpn.leakDetected || !vpn.protected ? "error" : "warning",
      title: "qBittorrent VPN protection needs attention",
      message: vpn.error ? cleanMessage(vpn.error) : "qBittorrent is online but VPN Shield is not reporting a protected route.",
      source: "VPN",
      createdAt
    });
  }

  if (qbittorrent?.errored && qbittorrent.errored > 0) {
    items.push({
      severity: "warning",
      title: "qBittorrent has errored torrents",
      message: `${qbittorrent.errored} torrent${qbittorrent.errored === 1 ? "" : "s"} in error state`,
      source: "qBittorrent",
      createdAt
    });
  }

  if (mail?.configured && mail.status === "online" && mail.unreadAlertThreshold && mail.unread >= mail.unreadAlertThreshold) {
    items.push({
      severity: "warning",
      title: "Mail unread threshold reached",
      message: `${mail.unread} unread messages in ${mail.mailbox}`,
      source: "Mail",
      createdAt
    });
  }

  rss?.filter((feed) => feed.error).slice(0, 3).forEach((feed) => {
    items.push({
      severity: feed.items.length ? "warning" : "error",
      title: `${feed.feed} RSS issue`,
      message: cleanMessage(feed.error),
      source: "RSS",
      createdAt
    });
  });

  return items;
}

async function collectHealthContext(config: DashboardConfig): Promise<HealthContext> {
  if (cachedContext && Date.now() - cachedContext.createdAt < cacheMs) {
    return cachedContext.context;
  }

  if (pendingContext) {
    return pendingContext;
  }

  pendingContext = buildHealthContext(config).finally(() => {
    pendingContext = null;
  });

  return pendingContext;
}

async function buildHealthContext(config: DashboardConfig): Promise<HealthContext> {
  const checkedAt = nowIso();
  const [
    internet,
    unifi,
    docker,
    plex,
    qbittorrent,
    homeAssistant,
    ollama,
    vpn,
    mail,
    rss
  ] = await Promise.all([
    safe(checkInternet()),
    safe(getUnifiWidgetData(config)),
    safe(getDockerWidgetData(config)),
    safe(getPlexWidgetData(config)),
    safe(getQBittorrentWidgetData(config)),
    safe(getServiceIntegrationData(config, "homeassistant")),
    safe(getOllamaInfo(config)),
    safe(getGluetunWidgetData(config)),
    config.widgets.mail || config.integrations?.mail ? safe(getMailWidgetData(config)) : Promise.resolve(null),
    safe(fetchRssFeeds(config.rssFeeds))
  ]);

  const rssStatus = buildRssStatus(rss);
  const internetStatus = internet === null
    ? rssStatus.status === "healthy"
      ? { status: "healthy" as const, message: "External traffic reachable" }
      : { status: "error" as const, message: "Internet check failed" }
    : { status: "healthy" as const, message: "External check reachable" };
  const unifiStatus = fromServiceStatus(unifi, unifi ? `${unifi.clients} clients · ${unifi.accessPoints ?? 0} APs` : "Online");
  const dockerStatus = buildDockerStatus(docker);
  const plexStatus = fromServiceStatus(plex, plex ? `${plex.activeStreams} streams · ${plex.libraries} libraries` : "Online");
  const qbitStatus = fromServiceStatus(qbittorrent, qbittorrent ? `${qbittorrent.total} torrents · ${qbittorrent.downloadMbps} Mbps down` : "Online");
  const homeAssistantStatus = buildHomeAssistantStatus(homeAssistant);
  const ollamaStatus = fromServiceStatus(ollama, ollama ? `${ollama.models.length} local models` : "Online");
  const vpnStatus = buildVpnStatus(vpn);
  const mailStatus = fromServiceStatus(mail, mail ? `${mail.unread} unread · ${mail.total} total` : "Online");

  const items = [
    item("Internet", internetStatus.status, internetStatus.message, checkedAt),
    item("UniFi", unifiStatus.status, unifiStatus.message, checkedAt),
    item("Docker", dockerStatus.status, dockerStatus.message, checkedAt),
    item("Plex", plexStatus.status, plexStatus.message, checkedAt),
    item("qBittorrent", qbitStatus.status, qbitStatus.message, checkedAt),
    item("Home Assistant", homeAssistantStatus.status, homeAssistantStatus.message, checkedAt),
    item("Ollama", ollamaStatus.status, ollamaStatus.message, checkedAt),
    item("VPN", vpnStatus.status, vpnStatus.message, checkedAt),
    ...(config.widgets.mail || config.integrations?.mail ? [item("Mail", mailStatus.status, mailStatus.message, checkedAt)] : []),
    item("RSS", rssStatus.status, rssStatus.message, checkedAt),
    item("Backups", "unknown", "Not configured yet", checkedAt),
    item("SSL", "unknown", "Not configured yet", checkedAt),
    item("UPS", "unknown", "Not configured yet", checkedAt)
  ];
  const overview = {
    overallStatus: overallStatus(items),
    items
  };
  const notificationMap = new Map<string, NotificationItem>();

  for (const notification of [...notificationsFromOverview(items, checkedAt), ...extraNotifications(docker, qbittorrent, vpn, mail, rss, checkedAt)]) {
    notificationMap.set(`${notification.source}:${notification.title}:${notification.message}`, notification);
  }

  const context = {
    overview,
    notifications: Array.from(notificationMap.values())
  };
  cachedContext = { createdAt: Date.now(), context };

  return context;
}

export async function getHealthOverview(config: DashboardConfig) {
  return (await collectHealthContext(config)).overview;
}

export async function getNotifications(config: DashboardConfig) {
  return syncNotificationEvents((await collectHealthContext(config)).notifications) as Promise<{ items: NotificationEvent[] }>;
}
