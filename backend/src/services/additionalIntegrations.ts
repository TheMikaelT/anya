import type { AdditionalIntegrationId, DashboardConfig } from "../types.js";
import { loadSecretSettings } from "./secrets.js";

type Status = "online" | "offline" | "unknown";

interface ServiceDefinition {
  id: AdditionalIntegrationId;
  name: string;
  summary: string;
  auth: "apiKey" | "token" | "basic" | "none" | "slug";
  placeholder: string;
}

interface HomeAssistantState {
  state?: string;
  entity_id?: string;
  attributes?: {
    friendly_name?: string;
  };
}

export interface HomeAssistantControlOption {
  entityId: string;
  label: string;
  domain: string;
  state: string;
}

export interface ServiceIntegrationData {
  id: AdditionalIntegrationId;
  name: string;
  status: Status;
  configured: boolean;
  metrics: Array<{ label: string; value: string | number }>;
  details?: string[];
  controls?: Array<{
    entityId: string;
    label: string;
    domain: string;
    state: string;
    action: "toggle" | "turn_on";
  }>;
  error?: string;
}

export const serviceDefinitions: ServiceDefinition[] = [
  { id: "homeassistant", name: "Home Assistant", summary: "Entities, unavailable devices and simple smart home health.", auth: "token", placeholder: "http://homeassistant.local:8123" },
  { id: "proxmox", name: "Proxmox", summary: "Nodes, VMs, LXCs and cluster resource totals.", auth: "token", placeholder: "https://proxmox.local:8006" },
  { id: "truenas", name: "TrueNAS", summary: "Pool health and storage usage.", auth: "apiKey", placeholder: "https://truenas.local" },
  { id: "pihole", name: "Pi-hole", summary: "DNS queries and blocked percentage.", auth: "apiKey", placeholder: "http://pi.hole" },
  { id: "adguard", name: "AdGuard Home", summary: "Protection status, DNS queries and blocked requests.", auth: "basic", placeholder: "http://adguard.local:3000" },
  { id: "uptimekuma", name: "Uptime Kuma", summary: "Public status page monitor health.", auth: "slug", placeholder: "http://uptime.local:3001" },
  { id: "portainer", name: "Portainer", summary: "Endpoint and container management status.", auth: "apiKey", placeholder: "https://portainer.local" },
  { id: "sonarr", name: "Sonarr", summary: "System status and health warnings.", auth: "apiKey", placeholder: "http://sonarr.local:8989" },
  { id: "radarr", name: "Radarr", summary: "System status and health warnings.", auth: "apiKey", placeholder: "http://radarr.local:7878" },
  { id: "lidarr", name: "Lidarr", summary: "System status and health warnings.", auth: "apiKey", placeholder: "http://lidarr.local:8686" },
  { id: "readarr", name: "Readarr", summary: "System status and health warnings.", auth: "apiKey", placeholder: "http://readarr.local:8787" },
  { id: "jellyfin", name: "Jellyfin", summary: "Server status and item counts.", auth: "apiKey", placeholder: "http://jellyfin.local:8096" },
  { id: "tautulli", name: "Tautulli", summary: "Plex activity and library stats from Tautulli.", auth: "apiKey", placeholder: "http://tautulli.local:8181" },
  { id: "nginxproxymanager", name: "Nginx Proxy Manager", summary: "Proxy host and SSL certificate status.", auth: "basic", placeholder: "http://npm.local:81" },
  { id: "traefik", name: "Traefik", summary: "Routers, services and entrypoint health.", auth: "none", placeholder: "http://traefik.local:8080" }
];

export function getServiceDefinition(id: AdditionalIntegrationId) {
  return serviceDefinitions.find((definition) => definition.id === id);
}

function cleanBaseUrl(baseUrl?: string) {
  return baseUrl?.trim().replace(/\/+$/, "");
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: {
      Accept: "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function requestText(url: string, init: RequestInit = {}): Promise<string> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: {
      Accept: "application/json, text/plain",
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function offline(id: AdditionalIntegrationId, error: unknown): ServiceIntegrationData {
  const definition = getServiceDefinition(id);
  return {
    id,
    name: definition?.name ?? id,
    status: "offline",
    configured: true,
    metrics: [],
    error: error instanceof Error ? error.message : "Request failed"
  };
}

function notConfigured(id: AdditionalIntegrationId): ServiceIntegrationData {
  const definition = getServiceDefinition(id);
  return {
    id,
    name: definition?.name ?? id,
    status: "unknown",
    configured: false,
    metrics: [],
    error: "Not configured"
  };
}

function authHeaders(id: AdditionalIntegrationId, token?: string, username?: string, password?: string): Record<string, string> {
  if (["homeassistant", "truenas"].includes(id) && token) {
    return { Authorization: `Bearer ${token}` };
  }

  if (["sonarr", "radarr", "lidarr", "readarr", "jellyfin", "portainer"].includes(id) && token) {
    return id === "portainer" ? { "X-API-Key": token } : { "X-Api-Key": token };
  }

  if (["adguard"].includes(id) && username && password) {
    return { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };
  }

  return {};
}

function arrPath(id: AdditionalIntegrationId) {
  return ["sonarr", "radarr", "lidarr", "readarr"].includes(id);
}

function friendlyEntityName(entityId = "") {
  const [, name = entityId] = entityId.split(".");
  return name
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function stateName(item: { attributes?: { friendly_name?: string }; entity_id?: string }) {
  return item.attributes?.friendly_name || friendlyEntityName(item.entity_id);
}

function homeAssistantDomain(item: HomeAssistantState) {
  return item.entity_id?.split(".")[0] ?? "";
}

function isHomeAssistantControl(item: HomeAssistantState) {
  return ["light", "switch", "automation", "script"].includes(homeAssistantDomain(item)) && Boolean(item.entity_id);
}

function isUsableHomeAssistantControl(item: HomeAssistantState) {
  return isHomeAssistantControl(item) && item.state !== "unavailable" && item.state !== "unknown";
}

function homeAssistantControlOption(item: HomeAssistantState): HomeAssistantControlOption {
  return {
    entityId: item.entity_id ?? "",
    label: stateName(item),
    domain: homeAssistantDomain(item),
    state: item.state ?? "unknown"
  };
}

function homeAssistantControlAction(item: HomeAssistantState) {
  return homeAssistantDomain(item) === "script" ? "turn_on" as const : "toggle" as const;
}

function buildHomeAssistantControls(states: HomeAssistantState[], selectedEntityIds: string[] = []) {
  const statesById = new Map(states.map((item) => [item.entity_id, item]));
  const selectedControls = selectedEntityIds
    .map((entityId) => statesById.get(entityId))
    .filter((item): item is HomeAssistantState => item !== undefined && isHomeAssistantControl(item));

  if (selectedControls.length) {
    return selectedControls.slice(0, 6).map((item) => ({
      ...homeAssistantControlOption(item),
      action: homeAssistantControlAction(item)
    }));
  }

  const activeLights = states
    .filter((item) => item.entity_id?.startsWith("light.") && item.state === "on")
    .slice(0, 4);
  const fallbackControls = states
    .filter((item) => isUsableHomeAssistantControl(item) && !activeLights.some((active) => active.entity_id === item.entity_id))
    .slice(0, Math.max(0, 6 - activeLights.length));

  return [...activeLights, ...fallbackControls].slice(0, 6).map((item) => ({
    ...homeAssistantControlOption(item),
    action: homeAssistantControlAction(item)
  }));
}

export async function getServiceIntegrationData(config: DashboardConfig, id: AdditionalIntegrationId): Promise<ServiceIntegrationData> {
  const settings = config.integrations?.additional?.[id];
  const secrets = await loadSecretSettings();
  const secret = secrets.additional?.[id];
  const baseUrl = cleanBaseUrl(settings?.baseUrl);
  const token = secret?.apiKey || secret?.token;
  const username = secret?.username;
  const password = secret?.password;

  if (!settings?.enabled || !baseUrl) {
    return notConfigured(id);
  }

  try {
    if (id === "homeassistant") {
      if (!token) return notConfigured(id);
      const states = await requestJson<HomeAssistantState[]>(`${baseUrl}/api/states`, {
        headers: authHeaders(id, token)
      });
      const lights = states.filter((item) => item.entity_id?.startsWith("light."));
      const switches = states.filter((item) => item.entity_id?.startsWith("switch."));
      const automations = states.filter((item) => item.entity_id?.startsWith("automation."));
      const scripts = states.filter((item) => item.entity_id?.startsWith("script."));
      const unavailable = states.filter((item) => item.state === "unavailable");
      const showMetrics = settings.showMetrics !== false;

      return {
        id,
        name: "Home Assistant",
        status: "online",
        configured: true,
        metrics: showMetrics ? [
          { label: "Entities", value: states.length },
          { label: "Unavailable", value: unavailable.length },
          { label: "Lights on", value: lights.filter((item) => item.state === "on").length },
          { label: "Switches on", value: switches.filter((item) => item.state === "on").length },
          { label: "Automations", value: automations.filter((item) => item.state === "on").length },
          { label: "Scripts", value: scripts.length }
        ] : [],
        details: showMetrics && unavailable.length
          ? unavailable.slice(0, 3).map((item) => `${stateName(item)} unavailable`)
          : showMetrics
            ? [...lights, ...switches].filter((item) => item.state === "on").slice(0, 3).map((item) => `${stateName(item)} on`)
            : [],
        controls: buildHomeAssistantControls(states, settings.controlEntityIds)
      };
    }

    if (id === "proxmox") {
      if (!token) return notConfigured(id);
      const data = await requestJson<{ data?: Array<{ type?: string; status?: string }> }>(`${baseUrl}/api2/json/cluster/resources`, {
        headers: { Authorization: token.startsWith("PVEAPIToken=") ? token : `PVEAPIToken=${token}` }
      });
      const resources = data.data ?? [];
      return {
        id,
        name: "Proxmox",
        status: "online",
        configured: true,
        metrics: [
          { label: "Nodes", value: resources.filter((item) => item.type === "node").length },
          { label: "VMs", value: resources.filter((item) => item.type === "qemu").length },
          { label: "LXCs", value: resources.filter((item) => item.type === "lxc").length }
        ],
        details: [`Online resources: ${resources.filter((item) => item.status === "online").length}`]
      };
    }

    if (id === "truenas") {
      if (!token) return notConfigured(id);
      const pools = await requestJson<Array<{ name?: string; status?: string; healthy?: boolean }>>(`${baseUrl}/api/v2.0/pool`, {
        headers: authHeaders(id, token)
      });
      return {
        id,
        name: "TrueNAS",
        status: pools.every((pool) => pool.healthy !== false && String(pool.status).toUpperCase() !== "OFFLINE") ? "online" : "offline",
        configured: true,
        metrics: [
          { label: "Pools", value: pools.length },
          { label: "Healthy", value: pools.filter((pool) => pool.healthy !== false).length }
        ],
        details: pools.slice(0, 3).map((pool) => `${pool.name ?? "Pool"}: ${pool.status ?? "unknown"}`)
      };
    }

    if (id === "pihole") {
      const auth = token ? `&auth=${encodeURIComponent(token)}` : "";
      const summary = await requestJson<Record<string, number>>(`${baseUrl}/admin/api.php?summaryRaw${auth}`);
      return {
        id,
        name: "Pi-hole",
        status: "online",
        configured: true,
        metrics: [
          { label: "Queries", value: summary.dns_queries_today ?? "-" },
          { label: "Blocked", value: summary.ads_blocked_today ?? "-" },
          { label: "Blocked %", value: summary.ads_percentage_today ? `${Number(summary.ads_percentage_today).toFixed(1)}%` : "-" }
        ]
      };
    }

    if (id === "adguard") {
      const stats = await requestJson<Record<string, number | boolean>>(`${baseUrl}/control/stats`, {
        headers: authHeaders(id, token, username, password)
      });
      return {
        id,
        name: "AdGuard Home",
        status: "online",
        configured: true,
        metrics: [
          { label: "Queries", value: Number(stats.num_dns_queries ?? 0) },
          { label: "Blocked", value: Number(stats.num_blocked_filtering ?? 0) },
          { label: "Replaced", value: Number(stats.num_replaced_safebrowsing ?? 0) }
        ]
      };
    }

    if (id === "uptimekuma") {
      const slug = settings.slug?.trim();
      if (!slug) return notConfigured(id);
      const page = await requestJson<{ heartbeatList?: Record<string, Array<{ status?: number }>> }>(`${baseUrl}/api/status-page/heartbeat/${encodeURIComponent(slug)}`);
      const heartbeats = Object.values(page.heartbeatList ?? {}).flat();
      return {
        id,
        name: "Uptime Kuma",
        status: heartbeats.some((item) => item.status === 0) ? "offline" : "online",
        configured: true,
        metrics: [
          { label: "Monitors", value: Object.keys(page.heartbeatList ?? {}).length },
          { label: "Down", value: heartbeats.filter((item) => item.status === 0).length }
        ]
      };
    }

    if (id === "portainer") {
      const status = await requestJson<{ Version?: string }>(`${baseUrl}/api/status`, {
        headers: authHeaders(id, token)
      });
      return {
        id,
        name: "Portainer",
        status: "online",
        configured: true,
        metrics: [{ label: "Version", value: status.Version ?? "online" }]
      };
    }

    if (arrPath(id)) {
      if (!token) return notConfigured(id);
      const [system, health] = await Promise.all([
        requestJson<{ version?: string }>(`${baseUrl}/api/v3/system/status`, { headers: authHeaders(id, token) }),
        requestJson<Array<unknown>>(`${baseUrl}/api/v3/health`, { headers: authHeaders(id, token) }).catch(() => [])
      ]);
      const definition = getServiceDefinition(id);
      return {
        id,
        name: definition?.name ?? id,
        status: health.length ? "offline" : "online",
        configured: true,
        metrics: [
          { label: "Version", value: system.version ?? "online" },
          { label: "Warnings", value: health.length }
        ]
      };
    }

    if (id === "jellyfin") {
      const [info, counts] = await Promise.all([
        requestJson<{ ServerName?: string; Version?: string }>(`${baseUrl}/System/Info/Public`),
        token
          ? requestJson<Record<string, number>>(`${baseUrl}/Items/Counts`, { headers: { "X-Emby-Token": token } }).catch(() => ({} as Record<string, number>))
          : Promise.resolve({} as Record<string, number>)
      ]);
      return {
        id,
        name: "Jellyfin",
        status: "online",
        configured: true,
        metrics: [
          { label: "Version", value: info.Version ?? "online" },
          { label: "Movies", value: counts.MovieCount ?? "-" },
          { label: "Series", value: counts.SeriesCount ?? "-" }
        ],
        details: [info.ServerName ?? "Jellyfin"]
      };
    }

    if (id === "tautulli") {
      if (!token) return notConfigured(id);
      const activity = await requestJson<{ response?: { data?: { stream_count?: number; total_bandwidth?: number } } }>(`${baseUrl}/api/v2?apikey=${encodeURIComponent(token)}&cmd=get_activity`);
      return {
        id,
        name: "Tautulli",
        status: "online",
        configured: true,
        metrics: [
          { label: "Streams", value: activity.response?.data?.stream_count ?? 0 },
          { label: "Bandwidth", value: activity.response?.data?.total_bandwidth ?? 0 }
        ]
      };
    }

    if (id === "nginxproxymanager") {
      const tokenResponse = username && password
        ? await requestJson<{ token?: string }>(`${baseUrl}/api/tokens`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identity: username, secret: password })
          })
        : null;
      const hosts = await requestJson<Array<{
        domain_names?: string[];
        enabled?: boolean;
        certificate_id?: number;
        ssl_forced?: boolean;
        block_exploits?: boolean;
        http2_support?: boolean;
        forward_host?: string;
        forward_port?: number;
      }>>(`${baseUrl}/api/nginx/proxy-hosts`, {
        headers: tokenResponse?.token ? { Authorization: `Bearer ${tokenResponse.token}` } : {}
      });
      const certificates = tokenResponse?.token
        ? await requestJson<Array<{ id?: number; nice_name?: string; expires_on?: string }>>(`${baseUrl}/api/nginx/certificates`, {
            headers: { Authorization: `Bearer ${tokenResponse.token}` }
          }).catch(() => [])
        : [];
      const certificateIds = new Set(certificates.map((certificate) => certificate.id).filter((value): value is number => typeof value === "number"));
      const enabledHosts = hosts.filter((host) => host.enabled !== false);
      const sslHosts = hosts.filter((host) => host.certificate_id && host.certificate_id > 0);
      const forcedSsl = hosts.filter((host) => host.ssl_forced);
      const staleCertificates = sslHosts.filter((host) => host.certificate_id && !certificateIds.has(host.certificate_id)).length;
      const expiringCertificates = certificates.filter((certificate) => {
        if (!certificate.expires_on) return false;
        const expiresAt = new Date(certificate.expires_on).getTime();
        return Number.isFinite(expiresAt) && expiresAt - Date.now() < 1000 * 60 * 60 * 24 * 30;
      }).length;
      return {
        id,
        name: "Nginx Proxy Manager",
        status: staleCertificates || expiringCertificates ? "unknown" : "online",
        configured: true,
        metrics: [
          { label: "Enabled", value: enabledHosts.length },
          { label: "Disabled", value: hosts.length - enabledHosts.length },
          { label: "SSL hosts", value: sslHosts.length },
          { label: "Force SSL", value: forcedSsl.length },
          { label: "Certs", value: certificates.length || "-" },
          { label: "Expiring", value: expiringCertificates }
        ],
        details: [
          ...hosts.slice(0, 4).map((host) => {
            const domain = host.domain_names?.[0] ?? "Proxy host";
            const target = host.forward_host ? ` -> ${host.forward_host}${host.forward_port ? `:${host.forward_port}` : ""}` : "";
            return `${domain}${target}`;
          }),
          ...(staleCertificates ? [`${staleCertificates} host certificate reference missing`] : []),
          ...(expiringCertificates ? [`${expiringCertificates} certificate expires soon`] : [])
        ]
      };
    }

    if (id === "traefik") {
      const overview = await requestJson<{ http?: { routers?: Record<string, unknown>; services?: Record<string, unknown> } }>(`${baseUrl}/api/overview`);
      return {
        id,
        name: "Traefik",
        status: "online",
        configured: true,
        metrics: [
          { label: "Routers", value: Object.keys(overview.http?.routers ?? {}).length },
          { label: "Services", value: Object.keys(overview.http?.services ?? {}).length }
        ]
      };
    }

    return notConfigured(id);
  } catch (error) {
    return offline(id, error);
  }
}

export async function runServiceIntegrationAction(config: DashboardConfig, id: AdditionalIntegrationId, entityId: string) {
  const settings = config.integrations?.additional?.[id];
  const secrets = await loadSecretSettings();
  const secret = secrets.additional?.[id];
  const baseUrl = cleanBaseUrl(settings?.baseUrl);
  const token = secret?.apiKey || secret?.token;

  if (id !== "homeassistant") {
    throw new Error("Service actions are only available for Home Assistant");
  }

  if (!settings?.enabled || !baseUrl || !token) {
    throw new Error("Home Assistant is not configured");
  }

  const [domain] = entityId.split(".");
  const service = domain === "script" ? "turn_on" : "toggle";

  if (!["light", "switch", "automation", "script"].includes(domain) || !entityId.includes(".")) {
    throw new Error("Unsupported Home Assistant entity");
  }

  await requestText(`${baseUrl}/api/services/${domain}/${service}`, {
    method: "POST",
    headers: {
      ...authHeaders(id, token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ entity_id: entityId })
  });

  return getServiceIntegrationData(config, id);
}

export async function getHomeAssistantControlOptions(config: DashboardConfig) {
  const settings = config.integrations?.additional?.homeassistant;
  const secrets = await loadSecretSettings();
  const secret = secrets.additional?.homeassistant;
  const baseUrl = cleanBaseUrl(settings?.baseUrl);
  const token = secret?.apiKey || secret?.token;

  if (!settings?.enabled || !baseUrl || !token) {
    throw new Error("Home Assistant is not configured");
  }

  const states = await requestJson<HomeAssistantState[]>(`${baseUrl}/api/states`, {
    headers: authHeaders("homeassistant", token)
  });
  const selected = (settings.controlEntityIds ?? []).slice(0, 6);
  const options = states
    .filter(isHomeAssistantControl)
    .map(homeAssistantControlOption)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  return {
    options,
    selected,
    showMetrics: settings.showMetrics !== false
  };
}

export async function getServicesStatusData(config: DashboardConfig) {
  const results = await Promise.all(serviceDefinitions.map((definition) => getServiceIntegrationData(config, definition.id)));
  const configured = results.filter((result) => result.configured);
  const online = configured.filter((result) => result.status === "online");

  return {
    status: configured.length === 0 ? "unknown" as const : online.length === configured.length ? "online" as const : "offline" as const,
    services: results
  };
}
