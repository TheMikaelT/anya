import http from "node:http";
import type { DashboardConfig, DockerSource } from "../types.js";

interface DockerPort {
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

interface DockerContainerSummary {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Ports: DockerPort[];
}

interface DockerImageSummary {
  Id: string;
  Containers?: number;
}

interface DockerSystemDf {
  Images?: DockerImageSummary[];
  Volumes?: Array<{ UsageData?: { Size?: number } }>;
}

interface DockerStats {
  memory_stats?: {
    usage?: number;
    limit?: number;
  };
  cpu_stats?: {
    cpu_usage?: {
      total_usage?: number;
      percpu_usage?: number[];
    };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats?: {
    cpu_usage?: {
      total_usage?: number;
    };
    system_cpu_usage?: number;
  };
}

export interface DockerWidgetData {
  status: "online" | "offline" | "unknown";
  running: number;
  stopped: number;
  images: number;
  volumeUsageGb: number;
  cpuPercent: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  containers: Array<{ name: string; status: string; sourceId?: string; sourceName?: string }>;
  stoppedContainers: Array<{ name: string; status: string; sourceId?: string; sourceName?: string }>;
  sources: Array<{
    id: string;
    name: string;
    type: DockerSource["type"];
    status: "online" | "offline" | "unknown";
    running: number;
    stopped: number;
    error?: string;
  }>;
  source: "docker-socket" | "docker-multi" | "mock";
  error?: string;
}

export function getDockerSources(config?: DashboardConfig): DockerSource[] {
  const configuredSources = config?.integrations?.docker?.sources;

  if (configuredSources?.length) {
    return configuredSources.filter((source) => source.enabled !== false);
  }

  const socketPath = config?.integrations?.docker?.socketPath ?? process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
  return [
    {
      id: "local",
      name: "Local Docker",
      type: "socket",
      enabled: true,
      socketPath
    }
  ];
}

export function requestDocker<T>(source: DockerSource, path: string): Promise<T> {
  return requestDockerJson<T>(source, path);
}

export async function requestDockerJson<T>(source: DockerSource, path: string, method = "GET", body?: unknown): Promise<T> {
  const responseBody = await requestDockerRaw(source, path, method, body, "json");
  return responseBody as T;
}

export async function requestDockerText(source: DockerSource, path: string, method = "GET", body?: unknown): Promise<string> {
  const responseBody = await requestDockerRaw(source, path, method, body, "text");
  return responseBody as string;
}

function stripDockerMultiplexedStream(buffer: Buffer) {
  const chunks: Buffer[] = [];
  let offset = 0;

  while (offset + 8 <= buffer.length) {
    const streamType = buffer[offset];
    const isMultiplexHeader = (streamType === 1 || streamType === 2) && buffer[offset + 1] === 0 && buffer[offset + 2] === 0 && buffer[offset + 3] === 0;

    if (!isMultiplexHeader) {
      return buffer.toString("utf-8");
    }

    const length = buffer.readUInt32BE(offset + 4);
    offset += 8;
    chunks.push(buffer.subarray(offset, offset + length));
    offset += length;
  }

  if (!chunks.length) {
    return buffer.toString("utf-8");
  }

  return Buffer.concat(chunks).toString("utf-8");
}

function parseDockerJson(buffer: Buffer, path: string) {
  const text = buffer.toString("utf-8").trim();

  if (!text) {
    throw new Error(`Docker API returned an empty response for ${path}`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Docker API returned invalid JSON for ${path}`);
  }
}

async function requestDockerRaw(source: DockerSource, path: string, method: string, body: unknown, responseType: "json" | "text"): Promise<unknown> {
  const payload = body === undefined ? undefined : JSON.stringify(body);

  if (source.type === "http") {
    const baseUrl = source.baseUrl?.replace(/\/+$/, "");

    if (!baseUrl) {
      return Promise.reject(new Error("Docker HTTP source has no base URL"));
    }

    return fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: responseType === "json" ? "application/json" : "*/*",
        ...(payload ? { "Content-Type": "application/json" } : {})
      },
      body: payload,
      signal: AbortSignal.timeout(4500)
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Docker API returned ${response.status}`);
      }

      if (responseType === "text") {
        return stripDockerMultiplexedStream(Buffer.from(await response.arrayBuffer()));
      }

      return parseDockerJson(Buffer.from(await response.arrayBuffer()), path);
    });
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        path,
        headers: {
          Accept: responseType === "json" ? "application/json" : "*/*",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {})
        },
        socketPath: source.socketPath ?? "/var/run/docker.sock"
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on("end", () => {
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`Docker API returned ${res.statusCode}`));
            return;
          }

          const buffer = Buffer.concat(chunks);

          if (responseType === "text") {
            resolve(stripDockerMultiplexedStream(buffer));
            return;
          }

          try {
            resolve(parseDockerJson(buffer, path));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(4500, () => {
      req.destroy(new Error(`Docker API timed out for ${path}`));
    });
    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

function normalizeName(name: string) {
  return name.replace(/^\//, "");
}

function isSelfContainer(name: string) {
  const normalized = normalizeName(name).toLowerCase();
  return normalized.includes("homedeck") || normalized.includes("anya");
}

function bytesToGb(value = 0) {
  return Number((value / 1024 / 1024 / 1024).toFixed(1));
}

function calculateCpuPercent(stats: DockerStats) {
  const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) - (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const systemDelta = (stats.cpu_stats?.system_cpu_usage ?? 0) - (stats.precpu_stats?.system_cpu_usage ?? 0);
  const cpuCount = stats.cpu_stats?.online_cpus ?? stats.cpu_stats?.cpu_usage?.percpu_usage?.length ?? 1;

  if (cpuDelta <= 0 || systemDelta <= 0) {
    return 0;
  }

  return (cpuDelta / systemDelta) * cpuCount * 100;
}

function countDisplayImages(images: DockerImageSummary[], systemDf: DockerSystemDf) {
  const systemImages = systemDf.Images?.length ? systemDf.Images : images;
  const activeImages = systemImages.filter((image) => (image.Containers ?? 0) > 0).length;

  if (activeImages > 0) {
    return activeImages;
  }

  return new Set(images.map((image) => image.Id)).size;
}

async function getDockerSourceData(source: DockerSource) {
  const [containers, images, systemDf] = await Promise.all([
    requestDocker<DockerContainerSummary[]>(source, "/containers/json?all=1"),
    requestDocker<DockerImageSummary[]>(source, "/images/json"),
    requestDocker<DockerSystemDf>(source, "/system/df").catch(() => ({}) as DockerSystemDf)
  ]);
  const runningContainers = containers.filter((container) => container.State === "running");
  const stoppedContainers = containers
    .filter((container) => container.State !== "running")
    .filter((container) => !isSelfContainer(container.Names[0] ?? ""))
    .slice(0, 8);
  const visibleContainers = runningContainers
    .filter((container) => !isSelfContainer(container.Names[0] ?? ""))
    .slice(0, 5);
  const stats = await Promise.all(
    visibleContainers.map((container) =>
      requestDocker<DockerStats>(source, `/containers/${container.Id}/stats?stream=false`).catch(() => null)
    )
  );
  const memoryUsedBytes = stats.reduce((sum, item) => sum + (item?.memory_stats?.usage ?? 0), 0);
  const memoryLimitBytes = stats.reduce((sum, item) => sum + (item?.memory_stats?.limit ?? 0), 0);
  const cpuPercent = stats.reduce((sum, item) => sum + (item ? calculateCpuPercent(item) : 0), 0);
  const volumeBytes = systemDf.Volumes?.reduce((sum, volume) => sum + (volume.UsageData?.Size ?? 0), 0) ?? 0;

  return {
    source,
    running: runningContainers.length,
    stopped: containers.filter((container) => container.State !== "running").length,
    images: countDisplayImages(images, systemDf),
    volumeUsageGb: bytesToGb(volumeBytes),
    cpuPercent,
    memoryUsedGb: bytesToGb(memoryUsedBytes),
    memoryTotalGb: bytesToGb(memoryLimitBytes),
    containers: visibleContainers.map((container) => ({
      name: normalizeName(container.Names[0] ?? container.Id.slice(0, 12)),
      status: container.State,
      sourceId: source.id,
      sourceName: source.name
    })),
    stoppedContainers: stoppedContainers.map((container) => ({
      name: normalizeName(container.Names[0] ?? container.Id.slice(0, 12)),
      status: container.Status || container.State,
      sourceId: source.id,
      sourceName: source.name
    }))
  };
}

export async function getDockerWidgetData(config?: DashboardConfig): Promise<DockerWidgetData> {
  const sources = getDockerSources(config);

  if (!sources.length) {
    return {
      status: "unknown",
      running: 0,
      stopped: 0,
      images: 0,
      volumeUsageGb: 0,
      cpuPercent: 0,
      memoryUsedGb: 0,
      memoryTotalGb: 0,
      containers: [],
      stoppedContainers: [],
      sources: [],
      source: "mock",
      error: "No Docker sources configured"
    };
  }

  try {
    const results = await Promise.allSettled(sources.map(getDockerSourceData));
    const online = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof getDockerSourceData>>> => result.status === "fulfilled");
    const sourceStatuses = results.map((result, index) => {
      const source = sources[index];

      if (result.status === "fulfilled") {
        return {
          id: source.id,
          name: source.name,
          type: source.type,
          status: "online" as const,
          running: result.value.running,
          stopped: result.value.stopped
        };
      }

      return {
        id: source.id,
        name: source.name,
        type: source.type,
        status: "offline" as const,
        running: 0,
        stopped: 0,
        error: result.reason instanceof Error ? result.reason.message : "Docker source unavailable"
      };
    });

    if (!online.length) {
      throw new Error(sourceStatuses.map((source) => `${source.name}: ${source.error ?? "unavailable"}`).join("; "));
    }

    return {
      status: "online",
      running: online.reduce((sum, result) => sum + result.value.running, 0),
      stopped: online.reduce((sum, result) => sum + result.value.stopped, 0),
      images: online.reduce((sum, result) => sum + result.value.images, 0),
      volumeUsageGb: Number(online.reduce((sum, result) => sum + result.value.volumeUsageGb, 0).toFixed(1)),
      cpuPercent: Number(online.reduce((sum, result) => sum + result.value.cpuPercent, 0).toFixed(1)),
      memoryUsedGb: Number(online.reduce((sum, result) => sum + result.value.memoryUsedGb, 0).toFixed(1)),
      memoryTotalGb: Number(online.reduce((sum, result) => sum + result.value.memoryTotalGb, 0).toFixed(1)),
      containers: online.flatMap((result) => result.value.containers).slice(0, 8),
      stoppedContainers: online.flatMap((result) => result.value.stoppedContainers).slice(0, 8),
      sources: sourceStatuses,
      source: sources.length > 1 ? "docker-multi" : "docker-socket",
      error: sourceStatuses.some((source) => source.status === "offline")
        ? sourceStatuses.filter((source) => source.status === "offline").map((source) => `${source.name}: ${source.error}`).join("; ")
        : undefined
    };
  } catch (error) {
    return {
      status: "unknown",
      running: 0,
      stopped: 0,
      images: 0,
      volumeUsageGb: 0,
      cpuPercent: 0,
      memoryUsedGb: 0,
      memoryTotalGb: 0,
      containers: [],
      stoppedContainers: [],
      sources: sources.map((source) => ({
        id: source.id,
        name: source.name,
        type: source.type,
        status: "offline",
        running: 0,
        stopped: 0,
        error: error instanceof Error ? error.message : "Docker source unavailable"
      })),
      source: "mock",
      error: error instanceof Error ? error.message : "Docker socket unavailable"
    };
  }
}
