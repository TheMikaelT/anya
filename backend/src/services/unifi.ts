import type { DashboardConfig } from "../types.js";
import { loadSecretSettings } from "./secrets.js";

interface UnifiResponse<T> {
  data?: T;
  meta?: {
    rc?: string;
    msg?: string;
  };
}

interface UnifiClient {
  is_guest?: boolean;
  is_wired?: boolean;
  essid?: string;
}

interface UnifiDevice {
  state?: number;
  disabled?: boolean;
  type?: string;
  name?: string;
  model?: string;
  version?: string;
  uptime?: number;
  uplink?: UnifiRateSource;
  wan1?: UnifiRateSource;
  wan2?: UnifiRateSource;
}

interface UnifiHealth {
  subsystem?: string;
  status?: string;
  latency?: number;
  speedtest_ping?: number;
  "rx_bytes-r"?: number;
  "tx_bytes-r"?: number;
  xput_down?: number;
  xput_up?: number;
  uptime_stats?: {
    WAN?: {
      latency_average?: number;
    };
  };
}

interface UnifiRateSource {
  "rx_bytes-r"?: number;
  "tx_bytes-r"?: number;
  rx_rate?: number;
  tx_rate?: number;
  up?: boolean;
}

interface ProtectBootstrap {
  cameras?: ProtectCamera[];
}

interface ProtectCamera {
  type?: string;
  state?: string;
  isConnected?: boolean;
  isAdopted?: boolean;
  isManaged?: boolean;
  isDeleting?: boolean;
  firmwareVersion?: string;
}

export interface UnifiWidgetData {
  status: "online" | "offline" | "unknown";
  configured: boolean;
  devices: number;
  accessPoints?: number;
  cameras?: number;
  gateways?: number;
  switches?: number;
  offlineDevices?: number;
  wiredClients?: number;
  wifiClients?: number;
  guestClients?: number;
  deviceSummary?: UnifiDeviceSummary[];
  clients: number;
  wanDownloadMbps: number;
  wanUploadMbps: number;
  trafficDownloadMbps?: number;
  trafficUploadMbps?: number;
  latencyMs: number;
  source: "unifi-os" | "legacy" | "mock";
  error?: string;
}

interface UnifiDeviceSummary {
  name: string;
  type: string;
  status: "online" | "offline" | "unknown";
  model?: string;
  version?: string;
  uptimeDays?: number;
}

interface UnifiSession {
  baseUrl: string;
  cookie: string;
  csrfToken?: string;
  apiPrefix: string;
  source: "unifi-os" | "legacy";
}

interface CachedUnifiSession extends UnifiSession {
  expiresAt: number;
  rateLimitedUntil?: number;
}

class UnifiRateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`UniFi login is rate limited. Trying again in ${Math.ceil(retryAfterMs / 1000)} seconds.`);
  }
}

class UnifiHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

const sessionTtlMs = 25 * 60 * 1000;
const rateLimitBackoffMs = 5 * 60 * 1000;
const sessionCache = new Map<string, CachedUnifiSession>();
const pendingLogins = new Map<string, Promise<CachedUnifiSession>>();

function emptyUnifiData(error: string, configured = false): UnifiWidgetData {
  return {
    status: configured ? "offline" : "unknown",
    configured,
    devices: 0,
    accessPoints: 0,
    cameras: 0,
    gateways: 0,
    switches: 0,
    offlineDevices: 0,
    wiredClients: 0,
    wifiClients: 0,
    guestClients: 0,
    deviceSummary: [],
    clients: 0,
    wanDownloadMbps: 0,
    wanUploadMbps: 0,
    trafficDownloadMbps: 0,
    trafficUploadMbps: 0,
    latencyMs: 0,
    source: "mock",
    error
  };
}

function cleanBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

async function withSelfSignedAllowed<T>(work: () => Promise<T>) {
  const previousReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  try {
    return await work();
  } finally {
    if (previousReject === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousReject;
    }
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function cookieHeader(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = headers.getSetCookie?.() ?? response.headers.get("set-cookie")?.split(/,(?=[^;]+?=)/) ?? [];
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function unifiSessionKey(baseUrl: string, username: string) {
  return `${baseUrl}|${username}`;
}

function cacheRateLimit(key: string) {
  const rateLimitedUntil = Date.now() + rateLimitBackoffMs;
  const current = sessionCache.get(key);

  if (current) {
    sessionCache.set(key, { ...current, expiresAt: 0, rateLimitedUntil });
  } else {
    sessionCache.set(key, {
      baseUrl: "",
      cookie: "",
      apiPrefix: "/proxy/network/api",
      source: "unifi-os",
      expiresAt: 0,
      rateLimitedUntil
    });
  }
}

function clearSession(baseUrl: string, username: string) {
  sessionCache.delete(unifiSessionKey(baseUrl, username));
}

function isAuthError(error: unknown) {
  return error instanceof UnifiHttpError && [401, 403].includes(error.status);
}

async function loginUnifiOs(baseUrl: string, username: string, password: string): Promise<UnifiSession> {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ username, password, rememberMe: true })
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new UnifiRateLimitError(rateLimitBackoffMs);
    }

    throw new Error(`UniFi OS login returned ${response.status}`);
  }

  const cookie = cookieHeader(response);

  if (!cookie) {
    throw new Error("UniFi OS login did not return a session cookie");
  }

  return {
    baseUrl,
    cookie,
    csrfToken: response.headers.get("x-csrf-token") ?? undefined,
    apiPrefix: "/proxy/network/api",
    source: "unifi-os"
  };
}

async function loginLegacy(baseUrl: string, username: string, password: string): Promise<UnifiSession> {
  const response = await fetchWithTimeout(`${baseUrl}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new UnifiRateLimitError(rateLimitBackoffMs);
    }

    throw new Error(`UniFi login returned ${response.status}`);
  }

  const cookie = cookieHeader(response);

  if (!cookie) {
    throw new Error("UniFi login did not return a session cookie");
  }

  return {
    baseUrl,
    cookie,
    apiPrefix: "/api",
    source: "legacy"
  };
}

async function login(baseUrl: string, username: string, password: string) {
  try {
    return await loginUnifiOs(baseUrl, username, password);
  } catch (unifiOsError) {
    if (unifiOsError instanceof UnifiRateLimitError) {
      throw unifiOsError;
    }

    try {
      return await loginLegacy(baseUrl, username, password);
    } catch {
      throw unifiOsError;
    }
  }
}

async function getSession(baseUrl: string, username: string, password: string, force = false): Promise<CachedUnifiSession> {
  const key = unifiSessionKey(baseUrl, username);
  const cached = sessionCache.get(key);
  const now = Date.now();

  if (cached?.rateLimitedUntil && cached.rateLimitedUntil > now) {
    throw new UnifiRateLimitError(cached.rateLimitedUntil - now);
  }

  if (!force && cached?.cookie && cached.expiresAt > now) {
    return cached;
  }

  const pending = pendingLogins.get(key);

  if (pending) {
    return pending;
  }

  const nextLogin = login(baseUrl, username, password)
    .then((session) => {
      const nextSession = {
        ...session,
        expiresAt: Date.now() + sessionTtlMs
      };

      sessionCache.set(key, nextSession);
      return nextSession;
    })
    .catch((error) => {
      if (error instanceof UnifiRateLimitError) {
        cacheRateLimit(key);
      }

      throw error;
    })
    .finally(() => {
      pendingLogins.delete(key);
    });

  pendingLogins.set(key, nextLogin);
  return nextLogin;
}

async function unifiGet<T>(session: UnifiSession, path: string): Promise<T> {
  const response = await fetchWithTimeout(`${session.baseUrl}${session.apiPrefix}${path}`, {
    headers: {
      Accept: "application/json",
      Cookie: session.cookie,
      ...(session.csrfToken ? { "X-CSRF-Token": session.csrfToken } : {})
    }
  });

  if (!response.ok) {
    throw new UnifiHttpError(`UniFi API returned ${response.status} for ${path}`, response.status);
  }

  const payload = (await response.json()) as UnifiResponse<T>;

  if (payload.meta?.rc && payload.meta.rc !== "ok") {
    throw new Error(payload.meta.msg ?? `UniFi API returned ${payload.meta.rc}`);
  }

  return payload.data ?? ([] as T);
}

async function unifiOsGet<T>(session: UnifiSession, path: string): Promise<T> {
  const response = await fetchWithTimeout(`${session.baseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      Cookie: session.cookie,
      ...(session.csrfToken ? { "X-CSRF-Token": session.csrfToken } : {})
    }
  });

  if (!response.ok) {
    throw new UnifiHttpError(`UniFi OS API returned ${response.status} for ${path}`, response.status);
  }

  return (await response.json()) as T;
}

function bytesPerSecondToMbps(value?: number) {
  if (!value || value <= 0) {
    return 0;
  }

  return Number(((value * 8) / 1_000_000).toFixed(1));
}

function bitsPerSecondToMbps(value?: number) {
  if (!value || value <= 0) {
    return 0;
  }

  return Number((value / 1_000_000).toFixed(2));
}

function pickWanMbps(health: UnifiHealth | undefined, key: "down" | "up") {
  const xputValue = key === "down" ? health?.xput_down : health?.xput_up;

  if (xputValue && xputValue > 0) {
    return Number(xputValue.toFixed(1));
  }

  return bytesPerSecondToMbps(key === "down" ? health?.["rx_bytes-r"] : health?.["tx_bytes-r"]);
}

function pickLatencyMs(www: UnifiHealth | undefined, wan: UnifiHealth | undefined) {
  const value = www?.latency ?? www?.speedtest_ping ?? wan?.uptime_stats?.WAN?.latency_average;

  if (!value || value <= 0) {
    return 0;
  }

  return Math.round(value);
}

function countOnlineDevices(devices: UnifiDevice[]) {
  return devices.filter((device) => device.state === 1 && !device.disabled);
}

function countAccessPoints(devices: UnifiDevice[]) {
  return countOnlineDevices(devices).filter((device) => device.type === "uap").length;
}

function countGateways(devices: UnifiDevice[]) {
  return countOnlineDevices(devices).filter((device) => ["udm", "ugw", "uxg"].includes(device.type ?? "")).length;
}

function countSwitches(devices: UnifiDevice[]) {
  return countOnlineDevices(devices).filter((device) => device.type === "usw").length;
}

function countOfflineDevices(devices: UnifiDevice[]) {
  return devices.filter((device) => device.state !== 1 || device.disabled).length;
}

function deviceTypeLabel(type?: string) {
  switch (type) {
    case "uap":
      return "AP";
    case "udm":
    case "ugw":
    case "uxg":
      return "Gateway";
    case "usw":
      return "Switch";
    default:
      return type ? type.toUpperCase() : "Device";
  }
}

function deviceStatus(device: UnifiDevice): UnifiDeviceSummary["status"] {
  if (device.disabled) {
    return "offline";
  }

  if (device.state === 1) {
    return "online";
  }

  if (device.state === undefined) {
    return "unknown";
  }

  return "offline";
}

function uptimeDays(value?: number) {
  if (!value || value <= 0) {
    return undefined;
  }

  return Math.floor(value / 86_400);
}

function buildDeviceSummary(devices: UnifiDevice[]) {
  return devices
    .map((device) => ({
      name: device.name?.trim() || device.model?.trim() || deviceTypeLabel(device.type),
      type: deviceTypeLabel(device.type),
      status: deviceStatus(device),
      model: device.model,
      version: device.version,
      uptimeDays: uptimeDays(device.uptime)
    }))
    .sort((first, second) => {
      if (first.status !== second.status) {
        return first.status === "offline" ? -1 : 1;
      }

      return first.type.localeCompare(second.type) || first.name.localeCompare(second.name);
    })
    .slice(0, 4);
}

function isUnifiProtectCamera(camera: ProtectCamera) {
  return Boolean(
    camera.isConnected &&
      camera.isAdopted &&
      camera.isManaged &&
      !camera.isDeleting &&
      camera.state === "CONNECTED" &&
      camera.firmwareVersion
  );
}

function pickGatewayTraffic(devices: UnifiDevice[], wan: UnifiHealth | undefined, key: "down" | "up") {
  const gateway = devices.find((device) => device.type === "udm" && device.state === 1 && !device.disabled);
  const rateKey = key === "down" ? "rx_rate" : "tx_rate";
  const byteRateKey = key === "down" ? "rx_bytes-r" : "tx_bytes-r";
  const rateSource = gateway?.wan1?.up ? gateway.wan1 : gateway?.uplink;
  const rate = rateSource?.[rateKey];

  if (rate && rate > 0) {
    return bitsPerSecondToMbps(rate);
  }

  return bytesPerSecondToMbps(rateSource?.[byteRateKey] ?? wan?.[byteRateKey]);
}

async function readUnifiData(session: UnifiSession, site: string): Promise<UnifiWidgetData> {
  const [clients, devices, health] = await Promise.all([
    unifiGet<UnifiClient[]>(session, `/s/${encodeURIComponent(site)}/stat/sta`),
    unifiGet<UnifiDevice[]>(session, `/s/${encodeURIComponent(site)}/stat/device`),
    unifiGet<UnifiHealth[]>(session, `/s/${encodeURIComponent(site)}/stat/health`).catch(() => [])
  ]);
  const protect = session.source === "unifi-os" ? await unifiOsGet<ProtectBootstrap>(session, "/proxy/protect/api/bootstrap").catch(() => null) : null;
  const wan = health.find((item) => item.subsystem === "wan");
  const www = health.find((item) => item.subsystem === "www");
  const onlineDevices = countOnlineDevices(devices);
  const wiredClients = clients.filter((client) => client.is_wired).length;
  const guestClients = clients.filter((client) => client.is_guest).length;

  return {
    status: "online",
    configured: true,
    devices: onlineDevices.length || devices.length,
    accessPoints: countAccessPoints(devices),
    cameras: protect?.cameras?.filter(isUnifiProtectCamera).length ?? 0,
    gateways: countGateways(devices),
    switches: countSwitches(devices),
    offlineDevices: countOfflineDevices(devices),
    wiredClients,
    wifiClients: Math.max(clients.length - wiredClients, 0),
    guestClients,
    deviceSummary: buildDeviceSummary(devices),
    clients: clients.length,
    wanDownloadMbps: pickWanMbps(www, "down"),
    wanUploadMbps: pickWanMbps(www, "up"),
    trafficDownloadMbps: pickGatewayTraffic(devices, wan, "down"),
    trafficUploadMbps: pickGatewayTraffic(devices, wan, "up"),
    latencyMs: pickLatencyMs(www, wan),
    source: session.source
  };
}

export async function getUnifiWidgetData(config: DashboardConfig): Promise<UnifiWidgetData> {
  const baseUrl = config.integrations?.unifi?.baseUrl?.trim();
  const site = config.integrations?.unifi?.site?.trim() || "default";
  const secrets = await loadSecretSettings();
  const username = secrets.unifi?.username?.trim();
  const password = secrets.unifi?.password;

  if (!baseUrl || !username || !password) {
    return emptyUnifiData("Configure UniFi in Manage -> Integrations.");
  }

  return withSelfSignedAllowed(async () => {
    try {
      const normalizedBaseUrl = cleanBaseUrl(baseUrl);
      const session = await getSession(normalizedBaseUrl, username, password);

      try {
        return await readUnifiData(session, site);
      } catch (error) {
        if (!isAuthError(error)) {
          throw error;
        }

        clearSession(normalizedBaseUrl, username);
        return await readUnifiData(await getSession(normalizedBaseUrl, username, password, true), site);
      }
    } catch (error) {
      return emptyUnifiData(error instanceof Error ? error.message : "UniFi request failed", true);
    }
  });
}
