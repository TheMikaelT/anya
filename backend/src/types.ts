export interface DashboardLink {
  id?: string;
  name: string;
  url: string;
  description: string;
  category: string;
  icon?: string;
  iconUrl?: string;
}

export type DashboardLinkInput = Omit<DashboardLink, "id"> & {
  id?: string;
};

export interface RssFeedConfig {
  name: string;
  url: string;
  radarLimit?: number;
  tickerLimit?: number;
}

export interface RssSettings {
  radarTotalItems?: number;
  tickerTotalItems?: number;
  tickerSpeedSeconds?: number;
}

export interface DashboardConfig {
  title: string;
  links: DashboardLink[];
  rssFeeds: RssFeedConfig[];
  rssSettings?: RssSettings;
  widgets: WidgetFlags;
  widgetOrder?: WidgetId[];
  mobileWidgetOrder?: WidgetId[];
  widgetLayout?: WidgetLayout;
  widgetStyle?: WidgetStyle;
  linkLayout?: LinkLayout;
  integrations?: IntegrationSettings;
  search?: SearchSettings;
  appearance?: AppearanceSettings;
}

export type CoreWidgetId = "unifi" | "plex" | "docker" | "rss" | "ollama" | "assistant" | "qbittorrent" | "gluetun" | "backup" | "notes" | "journal" | "today" | "tasks" | "mail";
export type WidgetId = CoreWidgetId | AdditionalIntegrationId;
export type WidgetLayout = "sidebar" | "center" | "rail";
export type WidgetStyle = "cards" | "compact" | "dense";
export type LinkLayout = "grouped" | "grid";

export type WidgetFlags = {
  rss?: boolean;
  rssTicker?: boolean;
  plex?: boolean;
  unifi?: boolean;
  docker?: boolean;
  ollama?: boolean;
  assistant?: boolean;
  qbittorrent?: boolean;
  gluetun?: boolean;
  backup?: boolean;
  notes?: boolean;
  journal?: boolean;
  today?: boolean;
  tasks?: boolean;
  mail?: boolean;
} & Partial<Record<AdditionalIntegrationId, boolean>>;

export type AdditionalIntegrationId =
  | "homeassistant"
  | "proxmox"
  | "truenas"
  | "pihole"
  | "adguard"
  | "uptimekuma"
  | "portainer"
  | "sonarr"
  | "radarr"
  | "lidarr"
  | "readarr"
  | "jellyfin"
  | "tautulli"
  | "nginxproxymanager"
  | "traefik";

export interface AdditionalIntegrationSettings {
  baseUrl?: string;
  apiKey?: string;
  token?: string;
  username?: string;
  password?: string;
  slug?: string;
  enabled?: boolean;
  showMetrics?: boolean;
  controlEntityIds?: string[];
}

export interface IntegrationSettings {
  docker?: {
    socketPath?: string;
    sources?: DockerSource[];
  };
  plex?: {
    baseUrl?: string;
    showRecentlyAdded?: boolean;
  };
  unifi?: {
    baseUrl?: string;
    site?: string;
  };
  ollama?: {
    baseUrl?: string;
    model?: string;
  };
  qbittorrent?: {
    baseUrl?: string;
    showNames?: boolean;
    torrentLimit?: number;
    speedUnit?: "mbps" | "mbs";
  };
  gluetun?: {
    dockerSourceId?: string;
    containerName?: string;
    controlUrl?: string;
    expectedHostIp?: string;
  };
  mail?: MailSettings;
  additional?: Partial<Record<AdditionalIntegrationId, AdditionalIntegrationSettings>>;
}

export interface MailSettings {
  providerName?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  mailbox?: string;
  maxItems?: number;
  unreadAlertThreshold?: number;
  openUrl?: string;
}

export interface SecretSettings {
  plex?: {
    token?: string;
  };
  unifi?: {
    username?: string;
    password?: string;
  };
  qbittorrent?: {
    username?: string;
    password?: string;
  };
  gluetun?: {
    apiKey?: string;
  };
  mail?: {
    password?: string;
  };
  additional?: Partial<Record<AdditionalIntegrationId, {
    apiKey?: string;
    token?: string;
    username?: string;
    password?: string;
  }>>;
}

export interface IntegrationSettingsInput {
  plex?: {
    baseUrl?: string;
    token?: string;
    showRecentlyAdded?: boolean;
  };
  unifi?: {
    baseUrl?: string;
    username?: string;
    password?: string;
    site?: string;
  };
  docker?: {
    socketPath?: string;
    sources?: DockerSourceInput[];
  };
  ollama?: {
    baseUrl?: string;
    model?: string;
  };
  qbittorrent?: {
    baseUrl?: string;
    username?: string;
    password?: string;
    showNames?: boolean;
    torrentLimit?: number;
    speedUnit?: "mbps" | "mbs";
  };
  gluetun?: {
    dockerSourceId?: string;
    containerName?: string;
    controlUrl?: string;
    apiKey?: string;
    expectedHostIp?: string;
  };
  mail?: MailSettings & {
    password?: string;
  };
  additional?: Partial<Record<AdditionalIntegrationId, AdditionalIntegrationSettings>>;
}

export type IntegrationId = "docker" | "plex" | "unifi" | "ollama" | "qbittorrent" | "gluetun" | "mail" | AdditionalIntegrationId;

export interface SearchSettings {
  label?: string;
  urlTemplate?: string;
  visible?: boolean;
}

export type AppearanceBackgroundMode = "default" | "preset" | "custom";
export type AppearancePresetId = "aurora" | "ember" | "midnight" | "forest";

export interface AppearanceSettings {
  background?: {
    mode?: AppearanceBackgroundMode;
    preset?: AppearancePresetId;
    imageUrl?: string;
    dim?: number;
    blur?: number;
  };
}

export interface RssItem {
  feed: string;
  title: string;
  link: string;
  date: string | null;
}

export interface RssFeedResult {
  feed: string;
  items: RssItem[];
  radarLimit?: number;
  tickerLimit?: number;
  error?: string;
  stale?: boolean;
  fetchedAt?: string;
  latestItemDate?: string | null;
}

export interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  iconUrl?: string;
  defaultUrl: string;
  aliases?: string[];
}

export interface IconCatalogItem {
  id: string;
  name: string;
  slug: string;
  source: "selfhst" | "dashboard-icons" | "template";
  iconUrl: string;
  aliases?: string[];
}

export interface IconCatalog {
  updatedAt: string | null;
  items: IconCatalogItem[];
  error?: string;
}

export interface ServiceStatus {
  id: string;
  status: "online" | "offline" | "unknown";
  httpStatus?: number;
  latencyMs?: number;
  error?: string;
}

export interface DockerSuggestion extends DashboardLinkInput {
  source: "docker";
  dockerSourceId?: string;
  dockerSourceName?: string;
  container: string;
  image: string;
}

export type DockerSourceType = "socket" | "http";

export interface DockerSource {
  id: string;
  name: string;
  type: DockerSourceType;
  enabled?: boolean;
  socketPath?: string;
  baseUrl?: string;
}

export type DockerSourceInput = Omit<DockerSource, "id"> & {
  id?: string;
};

export interface ImportPreview {
  source: string;
  configured: boolean;
  items: DashboardLinkInput[];
  skipped: number;
  error?: string;
}
