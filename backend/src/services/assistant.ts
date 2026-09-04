import type { DashboardConfig } from "../types.js";
import { recordAssistantTurn } from "./assistantHistory.js";
import { runAnyaAgentQuick } from "./agent.js";
import { getServiceIntegrationData, getServicesStatusData } from "./additionalIntegrations.js";
import { getDockerWidgetData } from "./docker.js";
import { getGluetunWidgetData } from "./gluetun.js";
import { getHealthOverview, getNotifications } from "./healthOverview.js";
import { chatWithOllama, chatWithOllamaStream, type OllamaMessage } from "./ollama.js";
import { getPlexWidgetData } from "./plex.js";
import { getQBittorrentWidgetData } from "./qbittorrent.js";
import { getUnifiWidgetData } from "./unifi.js";

interface AssistantContext {
  checkedAt: string;
  sources: string[];
  health?: Awaited<ReturnType<typeof getHealthOverview>>;
  notifications?: Awaited<ReturnType<typeof getNotifications>>["items"];
  unifi?: unknown;
  docker?: unknown;
  plex?: unknown;
  qbittorrent?: unknown;
  homeAssistant?: unknown;
  ollama?: unknown;
  vpn?: unknown;
  services?: unknown;
  links?: unknown;
}

interface DirectAnswer {
  response: string;
  sources: string[];
  checkedAt: string;
}

const directAnswerCache = new Map<string, DirectAnswer & { expiresAt: number; staleUntil: number }>();

async function safe<T>(source: string, work: Promise<T>, sources: string[]): Promise<T | { error: string } | undefined> {
  try {
    const result = await work;
    sources.push(source);
    return result;
  } catch (error) {
    sources.push(`${source}:error`);
    return {
      error: error instanceof Error ? error.message.replace(/https?:\/\/\S+/gi, "configured endpoint") : "Check failed"
    };
  }
}

function compactUnifi(data: Awaited<ReturnType<typeof getUnifiWidgetData>> | { error: string } | undefined) {
  if (!data || "error" in data) {
    return data;
  }

  return {
    status: data.status,
    configured: data.configured,
    clients: data.clients,
    accessPoints: data.accessPoints,
    cameras: data.cameras,
    gateways: data.gateways,
    switches: data.switches,
    wiredClients: data.wiredClients,
    wifiClients: data.wifiClients,
    guestClients: data.guestClients,
    offlineDevices: data.offlineDevices,
    latencyMs: data.latencyMs,
    wanDownloadMbps: data.wanDownloadMbps,
    wanUploadMbps: data.wanUploadMbps,
    trafficDownloadMbps: data.trafficDownloadMbps,
    trafficUploadMbps: data.trafficUploadMbps,
    devices: data.deviceSummary?.slice(0, 12).map((device) => ({
      name: device.name,
      type: device.type,
      status: device.status,
      uptimeDays: device.uptimeDays
    })),
    error: data.error
  };
}

function compactDocker(data: Awaited<ReturnType<typeof getDockerWidgetData>> | { error: string } | undefined) {
  if (!data || "error" in data) {
    return data;
  }

  return {
    status: data.status,
    running: data.running,
    stopped: data.stopped,
    images: data.images,
    volumeUsageGb: data.volumeUsageGb,
    containers: data.containers.slice(0, 8).map((container) => ({
      name: container.name,
      status: container.status,
      source: container.sourceName
    })),
    stoppedContainers: data.stoppedContainers.slice(0, 8).map((container) => ({
      name: container.name,
      status: container.status,
      source: container.sourceName
    })),
    sources: data.sources.map((source) => ({
      name: source.name,
      status: source.status,
      running: source.running,
      stopped: source.stopped,
      error: source.error
    })),
    error: data.error
  };
}

function compactPlex(data: Awaited<ReturnType<typeof getPlexWidgetData>> | { error: string } | undefined) {
  if (!data || "error" in data) {
    return data;
  }

  return {
    status: data.status,
    configured: data.configured,
    activeStreams: data.activeStreams,
    libraries: data.libraries,
    mediaLabel: data.mediaLabel,
    recentlyAdded: data.recentlyAdded.slice(0, 6).map((item) => item.title),
    recentActivity: data.recentActivity.slice(0, 6),
    error: data.error
  };
}

function compactQbittorrent(data: Awaited<ReturnType<typeof getQBittorrentWidgetData>> | { error: string } | undefined) {
  if (!data || "error" in data) {
    return data;
  }

  return {
    status: data.status,
    configured: data.configured,
    downloadMbps: data.downloadMbps,
    uploadMbps: data.uploadMbps,
    totalDownloadedGb: data.totalDownloadedGb,
    totalUploadedGb: data.totalUploadedGb,
    total: data.total,
    downloading: data.downloading,
    seeding: data.seeding,
    paused: data.paused,
    errored: data.errored,
    activeTorrents: data.torrents.slice(0, 8).map((torrent) => ({
      name: data.settings.showNames ? torrent.name : "hidden",
      state: torrent.state,
      progress: torrent.progress,
      downloadMbps: torrent.downloadMbps,
      uploadMbps: torrent.uploadMbps,
      etaSeconds: torrent.etaSeconds
    })),
    error: data.error
  };
}

function compactHomeAssistant(data: Awaited<ReturnType<typeof getServiceIntegrationData>> | { error: string } | undefined) {
  if (!data || "error" in data) {
    return data;
  }

  return {
    status: data.status,
    configured: data.configured,
    metrics: data.metrics,
    details: data.details?.slice(0, 8),
    controls: data.controls?.slice(0, 6).map((control) => ({
      label: control.label,
      domain: control.domain,
      state: control.state
    })),
    error: data.error
  };
}

function compactVpn(data: Awaited<ReturnType<typeof getGluetunWidgetData>> | { error: string } | undefined) {
  if (!data || "error" in data) {
    return data;
  }

  return {
    status: data.status,
    configured: data.configured,
    protected: data.protected,
    leakDetected: data.leakDetected,
    vpnIp: data.vpnIp,
    hostIp: data.hostIp,
    containerStatus: data.containerStatus,
    dockerSourceName: data.dockerSourceName,
    country: data.country,
    city: data.city,
    provider: data.provider,
    checkedAt: data.checkedAt,
    error: data.error
  };
}

function compactServices(data: Awaited<ReturnType<typeof getServicesStatusData>> | { error: string } | undefined) {
  if (!data || "error" in data) {
    return data;
  }

  return {
    status: data.status,
    services: data.services.slice(0, 16).map((service) => ({
      name: service.name,
      status: service.status,
      configured: service.configured,
      metrics: service.metrics.slice(0, 6),
      details: service.details?.slice(0, 4),
      error: service.error
    }))
  };
}

function compactLinks(config: DashboardConfig) {
  const categories = new Map<string, number>();

  for (const link of config.links) {
    categories.set(link.category, (categories.get(link.category) ?? 0) + 1);
  }

  return {
    total: config.links.length,
    categories: Array.from(categories.entries()).map(([name, count]) => ({ name, count }))
  };
}

async function buildAssistantContext(config: DashboardConfig): Promise<AssistantContext> {
  const sources: string[] = [];
  const checkedAt = new Date().toISOString();
  const [
    health,
    notifications,
    unifi,
    docker,
    plex,
    qbittorrent,
    homeAssistant,
    vpn,
    services
  ] = await Promise.all([
    safe("health", getHealthOverview(config), sources),
    safe("notifications", getNotifications(config), sources),
    safe("unifi", getUnifiWidgetData(config), sources),
    safe("docker", getDockerWidgetData(config), sources),
    safe("plex", getPlexWidgetData(config), sources),
    safe("qbittorrent", getQBittorrentWidgetData(config), sources),
    safe("homeassistant", getServiceIntegrationData(config, "homeassistant"), sources),
    safe("vpn", getGluetunWidgetData(config), sources),
    safe("services", getServicesStatusData(config), sources)
  ]);

  return {
    checkedAt,
    sources,
    health: health && !("error" in health) ? health : undefined,
    notifications: notifications && !("error" in notifications) ? notifications.items : undefined,
    unifi: compactUnifi(unifi),
    docker: compactDocker(docker),
    plex: compactPlex(plex),
    qbittorrent: compactQbittorrent(qbittorrent),
    homeAssistant: compactHomeAssistant(homeAssistant),
    vpn: compactVpn(vpn),
    services: compactServices(services),
    links: compactLinks(config)
  };
}

function truncateContext(context: AssistantContext) {
  const serialized = JSON.stringify(context);

  if (serialized.length <= 16_000) {
    return serialized;
  }

  return JSON.stringify({
    ...context,
    services: undefined,
    unifi: context.unifi,
    docker: context.docker,
    message: "Context was shortened to keep the local model prompt small."
  });
}

function lowerQuestion(question: string) {
  return question.toLowerCase();
}

function formatSources(context: AssistantContext) {
  return Array.from(new Set(context.sources));
}

function fireAndForgetTurn(input: Parameters<typeof recordAssistantTurn>[0]) {
  void recordAssistantTurn(input).catch((error) => {
    console.warn("Assistant history write failed", error instanceof Error ? error.message : "unknown error");
  });
}

async function cachedDirectAnswer(key: string, work: () => Promise<DirectAnswer>, timeoutMs = 1400, ttlMs = 20_000) {
  const now = Date.now();
  const cached = directAnswerCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("quick check timed out")), timeoutMs);
      })
    ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    directAnswerCache.set(key, {
      ...result,
      expiresAt: Date.now() + ttlMs,
      staleUntil: Date.now() + 5 * 60_000
    });

    return result;
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (cached && cached.staleUntil > now) {
      return {
        response: `Viimeisin tieto: ${cached.response}`,
        sources: cached.sources,
        checkedAt: cached.checkedAt
      };
    }

    return {
      response: "Tarkistus kestää tavallista kauemmin. Katso widgetistä viimeisin tila.",
      sources: [key],
      checkedAt: new Date().toISOString()
    };
  }
}

function isLatestPlexQuestion(question: string) {
  const normalized = lowerQuestion(question);
  const asksLatest = /(viimeksi|viimeinen|uusin|latest|recent|recently|äsken)/.test(normalized);
  const asksAdded = /(lisät|lisätty|added|tullut|ilmestynyt)/.test(normalized);
  const asksPlex = /(plex|elokuva|leffa|movie|media|sarja|show)/.test(normalized);

  return asksLatest && (asksAdded || asksPlex);
}

async function latestPlexAnswer(config: DashboardConfig) {
  const plex = await getPlexWidgetData(config);

  if (!plex.configured) {
    return {
      response: "Plex ei ole vielä konfiguroitu Anyassa.",
      checkedAt: new Date().toISOString()
    };
  }

  if (plex.status !== "online") {
    return {
      response: `Plex ei näytä olevan online. ${plex.error ?? "Viimeisintä lisäystä ei voi tarkistaa juuri nyt."}`,
      checkedAt: new Date().toISOString()
    };
  }

  const latest = plex.recentlyAdded[0]?.title;

  return {
    response: latest ? `Viimeksi Plexiin lisätty on ${latest}.` : "Plexissä ei näy viimeisimpiä lisäyksiä.",
    checkedAt: new Date().toISOString()
  };
}

async function directQuickAnswer(config: DashboardConfig, question: string) {
  const normalized = lowerQuestion(question);
  const checkedAt = new Date().toISOString();

  if (isLatestPlexQuestion(question)) {
    const response = await latestPlexAnswer(config);
    return { response: response.response, sources: ["plex"], checkedAt: response.checkedAt };
  }

  if (/vpn|gluetun|suoja|leak|vuoto/.test(normalized)) {
    return cachedDirectAnswer("vpn", async () => {
      const vpn = await getGluetunWidgetData(config);

      if (vpn.leakDetected || vpn.protected === false) {
        return {
          response: `VPN ei näytä turvalliselta. ${vpn.error ?? "Suojaus ei ole päällä."}`,
          sources: ["vpn"],
          checkedAt
        };
      }

      if (vpn.status === "online" && vpn.protected) {
        const location = [vpn.city, vpn.country].filter(Boolean).join(", ");
        return {
          response: `VPN on kunnossa. Reitti on suojattu${vpn.vpnIp ? ` IP:n ${vpn.vpnIp} kautta` : ""}${location ? ` (${location})` : ""}.`,
          sources: ["vpn"],
          checkedAt
        };
      }

      return {
        response: `VPN tila on ${vpn.status}. ${vpn.error ?? "Lisätietoa ei ole saatavilla."}`,
        sources: ["vpn"],
        checkedAt
      };
    });
  }

  if (/unifi|verkko|wifi|ap|kamera|client|latency/.test(normalized)) {
    const unifi = await getUnifiWidgetData(config);

    return {
      response: `UniFi: ${unifi.status}, ${unifi.clients ?? 0} clienttiä, ${unifi.accessPoints ?? 0} access pointtia, ${unifi.cameras ?? 0} kameraa, latency ${unifi.latencyMs ?? "-"} ms.`,
      sources: ["unifi"],
      checkedAt
    };
  }

  if (/docker|kontti|container|stopped|pysäht/.test(normalized)) {
    const docker = await getDockerWidgetData(config);
    const stopped = docker.stoppedContainers?.length
      ? docker.stoppedContainers.slice(0, 5).map((item) => `${item.name}${item.status ? ` (${item.status})` : ""}`).join(", ")
      : "ei pysähtyneitä kontteja listattuna";

    return {
      response: `Docker: ${docker.running ?? 0} käynnissä, ${docker.stopped ?? 0} pysähtynyt. Pysähtyneet: ${stopped}.`,
      sources: ["docker"],
      checkedAt
    };
  }

  if (/qbit|torrent|lataa|download|seed/.test(normalized)) {
    const qbit = await getQBittorrentWidgetData(config);

    return {
      response: `qBittorrent: ${qbit.status}, ${qbit.total ?? 0} torrenttia. Nopeus ${qbit.downloadMbps ?? 0}/${qbit.uploadMbps ?? 0} Mbps. Lataamassa ${qbit.downloading ?? 0}, seedaamassa ${qbit.seeding ?? 0}.`,
      sources: ["qbittorrent"],
      checkedAt
    };
  }

  if (/plex|media|juliste|stream|kirjasto|elokuva|leffa|movie/.test(normalized)) {
    const plex = await getPlexWidgetData(config);
    const latest = plex.recentlyAdded[0]?.title;

    return {
      response: `Plex: ${plex.status}, ${plex.activeStreams ?? 0} streamiä, ${plex.libraries ?? 0} kirjastoa.${latest ? ` Viimeksi lisätty: ${latest}.` : ""}`,
      sources: ["plex"],
      checkedAt
    };
  }

  return null;
}

function notificationAnswer(context: AssistantContext) {
  const notifications = context.notifications ?? [];

  if (!notifications.length) {
    return "Ei aktiivisia ilmoituksia. Kaikki tärkeimmät tarkistukset näyttävät olevan kunnossa.";
  }

  return [
    "Huomiota vaatii nyt:",
    ...notifications.slice(0, 6).map((item) => `- ${item.source}: ${item.title}. ${item.message}`)
  ].join("\n");
}

function healthItems(context: AssistantContext) {
  return context.health?.items ?? [];
}

function findHealthItem(context: AssistantContext, name: string) {
  return healthItems(context).find((item) => item.name.toLowerCase() === name.toLowerCase());
}

function quickAssistantAnswer(question: string, context: AssistantContext) {
  const normalized = lowerQuestion(question);

  if (/huomio|ongel|varoit|ilmoit|alhaalla|down|rikki|kriitt|terveys|health/.test(normalized)) {
    return notificationAnswer(context);
  }

  if (/vpn|gluetun|suoja|leak|vuoto/.test(normalized)) {
    const vpn = context.vpn as { status?: string; protected?: boolean; leakDetected?: boolean; vpnIp?: string | null; country?: string; city?: string; provider?: string; error?: string } | undefined;
    const health = findHealthItem(context, "VPN");

    if (!vpn) {
      return health ? `VPN: ${health.status}. ${health.message}` : "VPN-tietoa ei ole saatavilla.";
    }

    if (vpn.leakDetected || vpn.protected === false) {
      return `VPN ei näytä turvalliselta: ${vpn.error ?? health?.message ?? "protected=false tai leakDetected=true"}.`;
    }

    if (vpn.status === "online" && vpn.protected) {
      const location = [vpn.city, vpn.country].filter(Boolean).join(", ");
      return `VPN näyttää olevan kunnossa. Reitti on suojattu${vpn.vpnIp ? ` IP:n ${vpn.vpnIp} kautta` : ""}${location ? ` (${location})` : ""}.`;
    }

    return `VPN tila on ${vpn.status ?? "unknown"}. ${vpn.error ?? health?.message ?? "Lisätietoa ei ole saatavilla."}`;
  }

  if (/docker|kontti|container|stopped|pysäht/.test(normalized)) {
    const docker = context.docker as { running?: number; stopped?: number; stoppedContainers?: Array<{ name?: string; status?: string; source?: string }>; sources?: Array<{ name?: string; status?: string; error?: string }> } | undefined;

    if (!docker) {
      return "Docker-tietoa ei ole saatavilla.";
    }

    const stopped = docker.stoppedContainers?.length
      ? docker.stoppedContainers.map((item) => `${item.name}${item.status ? ` (${item.status})` : ""}`).join(", ")
      : "ei pysähtyneitä kontteja listattuna";
    const sourceIssues = docker.sources?.filter((source) => source.status && source.status !== "online") ?? [];
    const sourceText = sourceIssues.length ? ` Docker-lähdeongelmat: ${sourceIssues.map((source) => `${source.name}: ${source.status}`).join(", ")}.` : "";

    return `Docker: ${docker.running ?? 0} käynnissä, ${docker.stopped ?? 0} pysähtynyt. Pysähtyneet: ${stopped}.${sourceText}`;
  }

  if (/qbit|torrent|lataa|download|seed/.test(normalized)) {
    const qbit = context.qbittorrent as { status?: string; total?: number; downloading?: number; seeding?: number; paused?: number; errored?: number; downloadMbps?: number; uploadMbps?: number; activeTorrents?: Array<{ name?: string; state?: string; progress?: number; downloadMbps?: number }> } | undefined;

    if (!qbit) {
      return "qBittorrent-tietoa ei ole saatavilla.";
    }

    const active = qbit.activeTorrents?.filter((torrent) => (torrent.downloadMbps ?? 0) > 0 || /down/i.test(torrent.state ?? "")).slice(0, 4) ?? [];
    const activeText = active.length ? ` Aktiiviset: ${active.map((torrent) => `${torrent.name ?? "torrent"} ${torrent.downloadMbps ?? 0} Mbps`).join(", ")}.` : " Ei aktiivista latausta juuri nyt.";

    return `qBittorrent: ${qbit.status}, ${qbit.total ?? 0} torrenttia, ${qbit.downloading ?? 0} lataamassa, ${qbit.seeding ?? 0} seedaamassa, ${qbit.paused ?? 0} pausella, ${qbit.errored ?? 0} virheessä. Nopeus ${qbit.downloadMbps ?? 0}/${qbit.uploadMbps ?? 0} Mbps.${activeText}`;
  }

  if (/plex|media|juliste|recent|lisä/.test(normalized)) {
    const plex = context.plex as { status?: string; activeStreams?: number; libraries?: number; mediaLabel?: string; recentlyAdded?: string[]; recentActivity?: Array<{ title?: string; status?: string; client?: string }> } | undefined;

    if (!plex) {
      return "Plex-tietoa ei ole saatavilla.";
    }

    if (/(mikä|mitä|what).*(viimeksi|uusin|latest|recent).*(lisät|lisätty|added)|((viimeksi|uusin|latest).*(plex|elokuva|leffa|movie|media))/.test(normalized)) {
      const latest = plex.recentlyAdded?.[0];

      if (!latest) {
        return "Plexissä ei näy viimeisimpiä lisäyksiä.";
      }

      return `Viimeksi Plexiin lisätty on ${latest}.`;
    }

    const added = plex.recentlyAdded?.length ? plex.recentlyAdded.slice(0, 5).join(", ") : "ei viimeisimpiä lisäyksiä listattuna";
    const activity = plex.recentActivity?.length ? ` Aktiivisuus: ${plex.recentActivity.map((item) => `${item.title} ${item.status}`).join(", ")}.` : " Ei aktiivisia striimejä.";

    return `Plex: ${plex.status}, ${plex.activeStreams ?? 0} streamiä, ${plex.libraries ?? 0} kirjastoa, ${plex.mediaLabel ?? "media"}. Viimeksi lisätty: ${added}.${activity}`;
  }

  if (/unifi|verkko|wifi|ap|kamera|client|latency/.test(normalized)) {
    const unifi = context.unifi as { status?: string; clients?: number; accessPoints?: number; cameras?: number; gateways?: number; switches?: number; offlineDevices?: number; latencyMs?: number; trafficDownloadMbps?: number; trafficUploadMbps?: number } | undefined;

    if (!unifi) {
      return "UniFi-tietoa ei ole saatavilla.";
    }

    return `UniFi: ${unifi.status}, ${unifi.clients ?? 0} clienttiä, ${unifi.accessPoints ?? 0} AP:tä, ${unifi.cameras ?? 0} kameraa, ${unifi.offlineDevices ?? 0} offline-laitetta, latency ${unifi.latencyMs ?? "-"} ms, traffic ${unifi.trafficDownloadMbps ?? 0}/${unifi.trafficUploadMbps ?? 0} Mbps.`;
  }

  return null;
}

export async function askAnyaAssistant(config: DashboardConfig, question: string, sessionId?: string) {
  const trimmed = question.trim();

  if (!trimmed) {
    throw new Error("Question is required");
  }

  const agentAnswer = await runAnyaAgentQuick(config, trimmed, sessionId);
  const directAnswer = agentAnswer ?? await directQuickAnswer(config, trimmed);

  if (directAnswer) {
    const result = {
      model: "Anya quick check",
      response: directAnswer.response,
      durationMs: undefined,
      tokens: undefined,
      sources: directAnswer.sources,
      checkedAt: directAnswer.checkedAt
    };
    fireAndForgetTurn({ sessionId, question: trimmed, response: result.response, sources: result.sources, mode: "quick" });
    return result;
  }

  const context = await buildAssistantContext(config);
  const quickAnswer = quickAssistantAnswer(trimmed, context);

  if (quickAnswer) {
    const result = {
      model: "Anya quick check",
      response: quickAnswer,
      durationMs: undefined,
      tokens: undefined,
      sources: formatSources(context),
      checkedAt: context.checkedAt
    };
    fireAndForgetTurn({ sessionId, question: trimmed, response: result.response, sources: result.sources, mode: "context-quick" });
    return result;
  }

  const messages: OllamaMessage[] = [
    {
      role: "system",
      content: [
        "You are Anya Assistant, a concise homelab command center assistant.",
        "Answer in Finnish unless the user clearly asks for another language.",
        "Use only the supplied Anya context. If data is missing, say it is not available.",
        "Do not invent metrics. Do not mention or request passwords, tokens or secrets.",
        "Do not propose destructive actions. You may suggest safe checks and dashboard navigation.",
        "Answer only the specific question. If the user asks for one latest item, return one item only.",
        "Keep answers practical, short and specific."
      ].join(" ")
    },
    {
      role: "user",
      content: `Question: ${trimmed}\n\nAnya context JSON:\n${truncateContext(context)}`
    }
  ];
  const response = await chatWithOllama(config, messages);

  const result = {
    ...response,
    sources: Array.from(new Set(context.sources)),
    checkedAt: context.checkedAt
  };
  fireAndForgetTurn({ sessionId, question: trimmed, response: result.response, sources: result.sources, mode: "ollama" });
  return result;
}

export async function streamAnyaAssistant(config: DashboardConfig, question: string, sessionId?: string) {
  const trimmed = question.trim();

  if (!trimmed) {
    throw new Error("Question is required");
  }

  const agentAnswer = await runAnyaAgentQuick(config, trimmed, sessionId);
  const directAnswer = agentAnswer ?? await directQuickAnswer(config, trimmed);

  if (directAnswer) {
    fireAndForgetTurn({ sessionId, question: trimmed, response: directAnswer.response, sources: directAnswer.sources, mode: "stream-quick" });
    return {
      quickAnswer: directAnswer.response,
      stream: null,
      sources: directAnswer.sources,
      checkedAt: directAnswer.checkedAt
    };
  }

  const context = await buildAssistantContext(config);
  const quickAnswer = quickAssistantAnswer(trimmed, context);
  const sources = formatSources(context);

  if (quickAnswer) {
    fireAndForgetTurn({ sessionId, question: trimmed, response: quickAnswer, sources, mode: "stream-context-quick" });
    return {
      quickAnswer,
      stream: null,
      sources,
      checkedAt: context.checkedAt
    };
  }

  const messages: OllamaMessage[] = [
    {
      role: "system",
      content: [
        "You are Anya Assistant, a concise homelab command center assistant.",
        "Answer in Finnish unless the user clearly asks for another language.",
        "Use only the supplied Anya context. If data is missing, say it is not available.",
        "Do not invent metrics. Do not mention or request passwords, tokens or secrets.",
        "Do not propose destructive actions. You may suggest safe checks and dashboard navigation.",
        "Answer only the specific question. If the user asks for one latest item, return one item only.",
        "Keep answers practical, short and specific."
      ].join(" ")
    },
    {
      role: "user",
      content: `Question: ${trimmed}\n\nAnya context JSON:\n${truncateContext(context)}`
    }
  ];

  async function* loggedStream() {
    let responseText = "";

    try {
      for await (const content of chatWithOllamaStream(config, messages)) {
        responseText += content;
        yield content;
      }
    } finally {
      if (responseText.trim()) {
        fireAndForgetTurn({ sessionId, question: trimmed, response: responseText, sources, mode: "stream-ollama" });
      }
    }
  }

  return {
    quickAnswer: null,
    stream: loggedStream(),
    sources,
    checkedAt: context.checkedAt
  };
}
