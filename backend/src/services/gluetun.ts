import type { DashboardConfig, DockerSource } from "../types.js";
import { getDockerSources, requestDockerJson, requestDockerText } from "./docker.js";
import { loadSecretSettings } from "./secrets.js";

interface DockerContainerSummary {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
}

interface DockerExecCreateResponse {
  Id: string;
}

interface IpInfo {
  country_name?: string;
  country?: string;
  org?: string;
  city?: string;
}

interface GluetunPublicIpResponse {
  public_ip?: string;
  country?: string;
  city?: string;
  organization?: string;
}

interface ControlServerIpResult {
  ip: string;
  country?: string;
  city?: string;
  provider?: string;
}

let cachedHostIp: string | null = null;

export interface GluetunWidgetData {
  status: "online" | "offline" | "unknown";
  configured: boolean;
  protected: boolean;
  leakDetected: boolean;
  vpnIp: string | null;
  hostIp: string | null;
  container: string;
  containerStatus: string;
  dockerSourceName: string;
  source: "control-server" | "docker-exec";
  country?: string;
  city?: string;
  provider?: string;
  checkedAt: string;
  error?: string;
}

function normalizeName(name: string) {
  return name.replace(/^\//, "");
}

function configuredSource(config: DashboardConfig, sources: DockerSource[]) {
  const sourceId = config.integrations?.gluetun?.dockerSourceId;

  if (sourceId) {
    return sources.find((source) => source.id === sourceId) ?? sources[0];
  }

  return sources[0];
}

function configuredContainerName(config: DashboardConfig) {
  return config.integrations?.gluetun?.containerName?.trim() || "gluetun";
}

function isIp(value: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value.trim()) || /^[a-f0-9:]+$/i.test(value.trim());
}

async function detectHostIp(config: DashboardConfig) {
  const configured = config.integrations?.gluetun?.expectedHostIp?.trim();

  if (configured) {
    return configured;
  }

  for (const url of ["https://api4.ipify.org", "https://api.ipify.org", "https://ifconfig.me/ip", "https://icanhazip.com"]) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const text = (await response.text()).trim();

      if (isIp(text)) {
        cachedHostIp = text;
        return text;
      }
    } catch {
      // Try the next public IP endpoint.
    }
  }

  return cachedHostIp;
}

async function lookupIp(ip: string): Promise<IpInfo> {
  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500)
    });

    if (!response.ok) {
      return {};
    }

    return (await response.json()) as IpInfo;
  } catch {
    return {};
  }
}

async function execInContainer(source: DockerSource, containerId: string, command: string[]) {
  const exec = await requestDockerJson<DockerExecCreateResponse>(
    source,
    `/containers/${containerId}/exec`,
    "POST",
    {
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      Cmd: command
    }
  );

  return requestDockerText(source, `/exec/${exec.Id}/start`, "POST", {
    Detach: false,
    Tty: false
  });
}

async function detectContainerIp(source: DockerSource, containerId: string) {
  const output = await execInContainer(source, containerId, [
    "sh",
    "-c",
    "wget -qO- https://api.ipify.org || curl -fsS https://api.ipify.org || wget -qO- https://ifconfig.me/ip || curl -fsS https://ifconfig.me/ip"
  ]);
  const match = output.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-f0-9:]{6,})/i);

  if (!match) {
    throw new Error("Could not detect public IP inside the Gluetun container");
  }

  return match[1];
}

function parseControlServerResponse(text: string): ControlServerIpResult | null {
  try {
    const json = JSON.parse(text) as GluetunPublicIpResponse;
    const ip = json.public_ip?.trim();

    if (ip && isIp(ip)) {
      return {
        ip,
        country: json.country,
        city: json.city,
        provider: json.organization
      };
    }
  } catch {
    // Fall through to plain text matching for older Gluetun responses.
  }

  const match = text.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-f0-9:]{6,})/i);
  return match ? { ip: match[1] } : null;
}

async function detectControlServerIp(config: DashboardConfig): Promise<ControlServerIpResult | null> {
  const controlUrl = config.integrations?.gluetun?.controlUrl?.replace(/\/+$/, "");

  if (!controlUrl) {
    return null;
  }

  const secrets = await loadSecretSettings();
  const apiKey = secrets.gluetun?.apiKey;
  const parsedUrl = new URL(controlUrl);
  const endpoints = parsedUrl.pathname && parsedUrl.pathname !== "/"
    ? [""]
    : ["/v1/publicip/ip", "/v1/publicip"];
  const errors: string[] = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${controlUrl}${endpoint}`, {
        headers: {
          Accept: "application/json, text/plain",
          ...(apiKey ? { "X-API-Key": apiKey } : {})
        },
        signal: AbortSignal.timeout(4500)
      });

      if (!response.ok) {
        errors.push(`${endpoint || parsedUrl.pathname}: HTTP ${response.status}`);
        continue;
      }

      const text = await response.text();
      const result = parseControlServerResponse(text);

      if (result) {
        return result;
      }
      errors.push(`${endpoint || parsedUrl.pathname}: no IP in response`);
    } catch (error) {
      const message = error instanceof Error && error.name === "TimeoutError"
        ? "connection timed out"
        : error instanceof Error && error.message
          ? error.message
          : "connection failed";
      errors.push(`${endpoint || parsedUrl.pathname}: ${message}`);
    }
  }

  throw new Error(`Could not read public IP from Gluetun control server at ${controlUrl}. ${errors.join("; ")}. Check that the control server is published and reachable from the Anya host.`);
}

export async function getGluetunWidgetData(config: DashboardConfig): Promise<GluetunWidgetData> {
  const sources = getDockerSources(config);
  const source = configuredSource(config, sources);
  const containerName = configuredContainerName(config);
  const checkedAt = new Date().toISOString();
  const controlUrl = config.integrations?.gluetun?.controlUrl?.trim();
  const explicitlyConfigured = Boolean(
    controlUrl ||
    config.integrations?.gluetun?.containerName?.trim() ||
    config.integrations?.gluetun?.dockerSourceId?.trim()
  );

  if (!explicitlyConfigured) {
    return {
      status: "unknown",
      configured: false,
      protected: false,
      leakDetected: false,
      vpnIp: null,
      hostIp: null,
      container: containerName,
      containerStatus: "unknown",
      dockerSourceName: "Not configured",
      source: "docker-exec",
      checkedAt
    };
  }

  if (controlUrl) {
    try {
      const [controlResult, hostIp] = await Promise.all([
        detectControlServerIp(config),
        detectHostIp(config)
      ]);

      if (!controlResult?.ip) {
        throw new Error("Gluetun control server did not return a public IP");
      }

      const vpnIp = controlResult.ip;
      const leakDetected = Boolean(hostIp && vpnIp === hostIp);
      const info = await lookupIp(vpnIp);

      return {
        status: leakDetected ? "offline" : "online",
        configured: true,
        protected: !leakDetected,
        leakDetected,
        vpnIp,
        hostIp,
        container: containerName,
        containerStatus: "control server",
        dockerSourceName: "Gluetun control server",
        source: "control-server",
        country: controlResult.country ?? info.country_name ?? info.country,
        city: controlResult.city ?? info.city,
        provider: controlResult.provider ?? info.org,
        checkedAt,
        error: leakDetected ? "VPN IP matches the host public IP. Possible leak." : undefined
      };
    } catch (error) {
      return {
        status: "unknown",
        configured: true,
        protected: false,
        leakDetected: false,
        vpnIp: null,
        hostIp: await detectHostIp(config),
        container: containerName,
        containerStatus: "control server",
        dockerSourceName: "Gluetun control server",
        source: "control-server",
        checkedAt,
        error: error instanceof Error ? error.message : "Gluetun control server check failed"
      };
    }
  }

  if (!source) {
    return {
      status: "unknown",
      configured: false,
      protected: false,
      leakDetected: false,
      vpnIp: null,
      hostIp: null,
      container: containerName,
      containerStatus: "unknown",
      dockerSourceName: "No Docker source",
      source: "docker-exec",
      checkedAt,
      error: "Configure Docker first, then choose the Gluetun container."
    };
  }

  try {
    const containers = await requestDockerJson<DockerContainerSummary[]>(source, "/containers/json?all=1");
    const container = containers.find((item) => {
      const names = item.Names.map(normalizeName);
      return names.includes(containerName) || names.some((name) => name.endsWith(`_${containerName}_1`));
    });

    if (!container) {
      return {
        status: "offline",
        configured: true,
        protected: false,
        leakDetected: false,
        vpnIp: null,
        hostIp: await detectHostIp(config),
        container: containerName,
        containerStatus: "missing",
        dockerSourceName: source.name,
        source: "docker-exec",
        checkedAt,
        error: `Container "${containerName}" was not found on ${source.name}`
      };
    }

    if (container.State !== "running") {
      return {
        status: "offline",
        configured: true,
        protected: false,
        leakDetected: false,
        vpnIp: null,
        hostIp: await detectHostIp(config),
        container: normalizeName(container.Names[0] ?? containerName),
        containerStatus: container.Status || container.State,
        dockerSourceName: source.name,
        source: "docker-exec",
        checkedAt,
        error: `Container is ${container.State}`
      };
    }

    const [vpnIp, hostIp] = await Promise.all([
      detectContainerIp(source, container.Id),
      detectHostIp(config)
    ]);
    const leakDetected = Boolean(hostIp && vpnIp === hostIp);
    const info = await lookupIp(vpnIp);

    return {
      status: leakDetected ? "offline" : "online",
      configured: true,
      protected: !leakDetected,
      leakDetected,
      vpnIp,
      hostIp,
      container: normalizeName(container.Names[0] ?? containerName),
      containerStatus: container.Status || container.State,
      dockerSourceName: source.name,
      source: "docker-exec",
      country: info.country_name ?? info.country,
      city: info.city,
      provider: info.org,
      checkedAt,
      error: leakDetected ? "VPN IP matches the host public IP. Possible leak." : undefined
    };
  } catch (error) {
    return {
      status: "unknown",
      configured: true,
      protected: false,
      leakDetected: false,
      vpnIp: null,
      hostIp: await detectHostIp(config),
      container: containerName,
      containerStatus: "unknown",
      dockerSourceName: source.name,
      source: "docker-exec",
      checkedAt,
      error: error instanceof Error ? error.message : "Gluetun check failed"
    };
  }
}
