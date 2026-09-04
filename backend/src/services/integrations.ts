import type { DashboardConfig, DockerSource } from "../types.js";
import { serviceDefinitions } from "./additionalIntegrations.js";
import { loadSecretSettings } from "./secrets.js";

export interface IntegrationInfo {
  id: "docker" | "plex" | "unifi" | "ollama" | "qbittorrent" | "gluetun" | "mail" | typeof serviceDefinitions[number]["id"];
  name: string;
  status: "configured" | "needs_config" | "available";
  summary: string;
  fields: string[];
  secretFields: string[];
  settings: Record<string, string | number | boolean | DockerSource[]>;
  instructions: string[];
}

export async function getIntegrationInfo(config: DashboardConfig): Promise<IntegrationInfo[]> {
  const plex = config.integrations?.plex;
  const unifi = config.integrations?.unifi;
  const docker = config.integrations?.docker;
  const ollama = config.integrations?.ollama;
  const qbittorrent = config.integrations?.qbittorrent;
  const gluetun = config.integrations?.gluetun;
  const gluetunConfigured = Boolean(gluetun?.controlUrl || gluetun?.containerName || gluetun?.dockerSourceId);
  const mail = config.integrations?.mail;
  const secrets = await loadSecretSettings();

  const coreIntegrations: IntegrationInfo[] = [
    {
      id: "docker",
      name: "Docker",
      status: process.env.DOCKER_SOCKET_PATH || docker?.socketPath || docker?.sources?.length ? "configured" : "available",
      summary: "Reads one or more Docker Engines through a local socket or a read-only Docker Socket Proxy. No username or token is stored.",
      fields: ["docker.sources"],
      secretFields: [],
      settings: {
        socketPath: docker?.socketPath ?? process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock",
        sources: docker?.sources?.length
          ? docker.sources
          : [
              {
                id: "local",
                name: "Local Docker",
                type: "socket",
                enabled: true,
                socketPath: docker?.socketPath ?? process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock"
              }
            ]
      },
      instructions: [
        "Use Local socket for the Docker host running Anya.",
        "For another Docker host, run a read-only Docker Socket Proxy on that host and add its URL here.",
        "Do not expose the raw Docker API directly to the internet."
      ]
    },
    {
      id: "plex",
      name: "Plex",
      status: plex?.baseUrl && secrets.plex?.token ? "configured" : "needs_config",
      summary: "Needs your Plex base URL and token. The token is stored locally in config/secrets.json and is never returned to the browser.",
      fields: ["plex.baseUrl"],
      secretFields: ["plex.token"],
      settings: {
        baseUrl: plex?.baseUrl ?? "",
        showRecentlyAdded: plex?.showRecentlyAdded ?? true,
        hasToken: Boolean(secrets.plex?.token)
      },
      instructions: [
        "Open Manage, then Integrations.",
        "Enter your Plex base URL, for example http://plex.local:32400.",
        "Paste your Plex token. It is saved only to local config/secrets.json."
      ]
    },
    {
      id: "unifi",
      name: "UniFi Network",
      status: unifi?.baseUrl && secrets.unifi?.username && secrets.unifi?.password ? "configured" : "needs_config",
      summary: "Needs your UniFi controller URL and local credentials. Credentials are stored locally in config/secrets.json and are never returned to the browser.",
      fields: ["unifi.baseUrl", "unifi.site"],
      secretFields: ["unifi.username", "unifi.password"],
      settings: {
        baseUrl: unifi?.baseUrl ?? "",
        site: unifi?.site ?? "default",
        hasUsername: Boolean(secrets.unifi?.username),
        hasPassword: Boolean(secrets.unifi?.password)
      },
      instructions: [
        "Open Manage, then Integrations.",
        "Enter your UniFi Network controller URL and site.",
        "Paste credentials for a local UniFi user. They are saved only to local config/secrets.json."
      ]
    },
    {
      id: "ollama",
      name: "Ollama",
      status: ollama?.baseUrl ? "configured" : "needs_config",
      summary: "Connects to your local Ollama API for a lightweight Quick Ask widget. Prompts and answers are not stored.",
      fields: ["ollama.baseUrl", "ollama.model"],
      secretFields: [],
      settings: {
        baseUrl: ollama?.baseUrl ?? "",
        model: ollama?.model ?? ""
      },
      instructions: [
        "Enter your Ollama API URL, for example http://ollama.example.local:11434.",
        "Enter a default model, for example llama3.1:8b. You can also choose a model from the widget after saving.",
        "Anya sends prompts through the backend and does not save conversations."
      ]
    },
    {
      id: "qbittorrent",
      name: "qBittorrent",
      status: qbittorrent?.baseUrl && secrets.qbittorrent?.username && secrets.qbittorrent?.password ? "configured" : "needs_config",
      summary: "Reads qBittorrent Web UI API stats through the backend. Username and password are stored locally in config/secrets.json.",
      fields: ["qbittorrent.baseUrl"],
      secretFields: ["qbittorrent.username", "qbittorrent.password"],
      settings: {
        baseUrl: qbittorrent?.baseUrl ?? "",
        hasUsername: Boolean(secrets.qbittorrent?.username),
        hasPassword: Boolean(secrets.qbittorrent?.password),
        showNames: qbittorrent?.showNames ?? false,
        torrentLimit: String(qbittorrent?.torrentLimit ?? 5),
        speedUnit: qbittorrent?.speedUnit ?? "mbps"
      },
      instructions: [
        "Enter your qBittorrent Web UI URL, for example https://qbittorrent.example.local.",
        "Use a qBittorrent Web UI username and password. They are saved only to local config/secrets.json.",
        "The widget is read-only and shows transfer speed, torrent counts and recent active torrents."
      ]
    },
    {
      id: "gluetun",
      name: "Gluetun VPN",
      status: gluetunConfigured ? "configured" : "needs_config",
      summary: "Checks the public IP through Gluetun control server or from inside the Gluetun container and warns if it matches your host/WAN IP.",
      fields: ["gluetun.controlUrl", "gluetun.dockerSourceId", "gluetun.containerName", "gluetun.expectedHostIp"],
      secretFields: ["gluetun.apiKey"],
      settings: {
        dockerSourceId: gluetun?.dockerSourceId ?? docker?.sources?.[0]?.id ?? "local",
        containerName: gluetun?.containerName ?? "gluetun",
        controlUrl: gluetun?.controlUrl ?? "",
        hasApiKey: Boolean(secrets.gluetun?.apiKey),
        expectedHostIp: gluetun?.expectedHostIp ?? ""
      },
      instructions: [
        "Preferred for another Docker host: enable Gluetun control server and enter its URL, for example http://gluetun.example.local:8000.",
        "Alternative: choose a Docker Socket Proxy source that allows containers/json and exec routes, then enter the container name.",
        "Optional: enter your normal home/WAN IP. If empty, Anya detects the host public IP automatically."
      ]
    },
    {
      id: "mail",
      name: "Mail / IMAP",
      status: mail?.host && mail?.username && secrets.mail?.password ? "configured" : "needs_config",
      summary: "Reads your IMAP inbox through the backend. The widget is read-only and passwords stay in config/secrets.json.",
      fields: ["mail.providerName", "mail.host", "mail.port", "mail.secure", "mail.username", "mail.mailbox", "mail.maxItems", "mail.unreadAlertThreshold", "mail.openUrl"],
      secretFields: ["mail.password"],
      settings: {
        providerName: mail?.providerName ?? "Mail",
        host: mail?.host ?? "",
        port: mail?.port ?? 993,
        secure: mail?.secure !== false,
        username: mail?.username ?? "",
        mailbox: mail?.mailbox ?? "INBOX",
        maxItems: String(mail?.maxItems ?? 8),
        unreadAlertThreshold: String(mail?.unreadAlertThreshold ?? 0),
        openUrl: mail?.openUrl ?? "",
        hasPassword: Boolean(secrets.mail?.password)
      },
      instructions: [
        "Enter an IMAP host, username and app password.",
        "Anya opens the mailbox read-only and only shows headers: sender, subject, time and unread state.",
        "Use an app password where possible. Do not use this on a public Anya instance."
      ]
    }
  ];

  const additionalIntegrations: IntegrationInfo[] = serviceDefinitions.map((definition) => {
    const settings = config.integrations?.additional?.[definition.id];
    const secret = secrets.additional?.[definition.id];
    const hasSecret = Boolean(secret?.apiKey || secret?.token || secret?.username || secret?.password);
    const needsSecret = definition.auth !== "none" && definition.auth !== "slug";
    const configured = Boolean(settings?.enabled && settings?.baseUrl && (!needsSecret || hasSecret));

    return {
      id: definition.id,
      name: definition.name,
      status: configured ? "configured" : "needs_config",
      summary: definition.summary,
      fields: ["baseUrl", ...(definition.auth === "slug" ? ["slug"] : [])],
      secretFields: definition.auth === "apiKey" ? ["apiKey"] : definition.auth === "token" ? ["token"] : definition.auth === "basic" ? ["username", "password"] : [],
      settings: {
        baseUrl: settings?.baseUrl ?? "",
        slug: settings?.slug ?? "",
        enabled: settings?.enabled === true,
        hasApiKey: Boolean(secret?.apiKey),
        hasToken: Boolean(secret?.token),
        hasUsername: Boolean(secret?.username),
        hasPassword: Boolean(secret?.password)
      },
      instructions: [
        `Enter the ${definition.name} base URL.`,
        "Enable it when you want it included in the Services status widget.",
        "Secrets are stored locally in config/secrets.json and are not returned to the browser."
      ]
    };
  });

  return [...coreIntegrations, ...additionalIntegrations];
}
