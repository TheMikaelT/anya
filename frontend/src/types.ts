export interface DashboardLink {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  icon?: string;
  iconUrl?: string;
}

export type DashboardLinkInput = Omit<DashboardLink, "id">;

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

export interface ImportResponse extends LinksResponse {
  imported: number;
  skipped: number;
}

export interface LibraryRefreshResponse extends LinksResponse {
  updated: number;
  icons: number;
}

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

export type CoreWidgetId = "unifi" | "plex" | "docker" | "rss" | "ollama" | "assistant" | "qbittorrent" | "gluetun" | "backup" | "notes" | "journal" | "today" | "tasks" | "mail";
export type WidgetId = CoreWidgetId | AdditionalIntegrationId;
export type WidgetLayout = "sidebar" | "center" | "rail";
export type WidgetStyle = "cards" | "compact" | "dense";
export type LinkLayout = "grouped" | "grid";

export interface LinksResponse {
  title: string;
  links: DashboardLink[];
  widgets: WidgetFlags;
  widgetOrder: WidgetId[];
  mobileWidgetOrder: WidgetId[];
  widgetLayout: WidgetLayout;
  widgetStyle: WidgetStyle;
  linkLayout: LinkLayout;
  search: SearchSettings;
  rssSettings: RssSettings;
  appearance: AppearanceSettings;
}

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

export interface RssResponse {
  feeds: RssFeedResult[];
  rssSettings: RssSettings;
}

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

export type NotificationSeverity = "warning" | "error" | "info";

export interface NotificationItem {
  id: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  source: string;
  createdAt: string;
  status: "open" | "acknowledged" | "resolved";
  acknowledgedAt: string | null;
  lastSeenAt: string;
  resolvedAt: string | null;
  occurrences: number;
}

export interface NotificationsResponse {
  items: NotificationItem[];
}

export interface BackupRun {
  id: string;
  status: "running" | "success" | "failed";
  targetPath: string;
  filesCount: number;
  bytesWritten: number;
  message: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface BackupStatusResponse {
  backupDirectory: string;
  targetType: "local" | "external";
  targetLabel: string;
  targetAvailable: boolean;
  targetMessage: string;
  lastRun: BackupRun | null;
  runs: BackupRun[];
  recommendedTarget?: string;
  run?: BackupRun;
  lastVerification?: BackupVerification;
}

export interface BackupVerification {
  backupId: string;
  status: "ok" | "warning" | "failed";
  checkedAt: string;
  targetPath: string;
  items: Array<{
    name: string;
    status: "ok" | "missing" | "warning";
    message: string;
  }>;
  message: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  title: string;
  body: string;
  tags?: string[];
  pinned?: boolean;
}

export interface JournalEntry {
  id: string;
  entryDate: string;
  title: string;
  body: string;
  mood?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryInput {
  entryDate?: string;
  title?: string;
  body: string;
  mood?: string;
}

export type TaskStatus = "open" | "done";
export type ReminderStatus = "scheduled" | "done";

export interface TaskItem {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderItem {
  id: string;
  title: string;
  message: string;
  remindAt: string;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  notes?: string;
  status?: TaskStatus;
  dueAt?: string | null;
}

export interface ReminderInput {
  title: string;
  message?: string;
  remindAt: string;
  status?: ReminderStatus;
}

export interface TodayOverview {
  date: string;
  notes: {
    pinned: Note[];
    recent: Note[];
  };
  journal: {
    today: JournalEntry[];
    recent: JournalEntry[];
  };
  tasks: {
    dueToday: TaskItem[];
    open: TaskItem[];
  };
  reminders: {
    dueToday: ReminderItem[];
    upcoming: ReminderItem[];
  };
  backup: {
    status: "healthy" | "warning" | "unknown";
    message: string;
    lastRunAt: string | null;
    targetType: "local" | "external";
    targetAvailable: boolean;
  };
}

export interface UnifiData {
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

export interface UnifiDeviceSummary {
  name: string;
  type: string;
  status: "online" | "offline" | "unknown";
  model?: string;
  version?: string;
  uptimeDays?: number;
}

export interface PlexActivity {
  title: string;
  status: "playing" | "paused";
  client: string;
}

export interface PlexRecentlyAdded {
  title: string;
  year?: string;
  posterUrl?: string;
}

export interface PlexData {
  status: "online" | "offline" | "unknown";
  configured: boolean;
  activeStreams: number;
  libraries: number;
  mediaLabel: string;
  movies: number;
  shows: number;
  recentlyAdded: PlexRecentlyAdded[];
  recentActivity: PlexActivity[];
  settings?: {
    showRecentlyAdded: boolean;
  };
  error?: string;
}

export interface DockerContainer {
  name: string;
  status: string;
  sourceId?: string;
  sourceName?: string;
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

export interface DockerData {
  status: "online" | "offline" | "unknown";
  running: number;
  stopped: number;
  images: number;
  volumeUsageGb: number;
  cpuPercent: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  containers: DockerContainer[];
  stoppedContainers: DockerContainer[];
  sources: Array<{
    id: string;
    name: string;
    type: DockerSourceType;
    status: "online" | "offline" | "unknown";
    running: number;
    stopped: number;
    error?: string;
  }>;
  source: "docker-socket" | "docker-multi" | "mock";
  error?: string;
}

export interface OllamaData {
  status: "online" | "offline" | "unknown";
  configured: boolean;
  baseUrl: string;
  model: string;
  models: string[];
  error?: string;
}

export interface OllamaAskResponse {
  model: string;
  response: string;
  durationMs?: number;
  tokens?: number;
}

export interface AssistantAskResponse extends OllamaAskResponse {
  sources: string[];
  checkedAt: string;
}

export interface OllamaMessage {
  role: "user" | "assistant";
  content: string;
}

export interface QBittorrentTorrent {
  name: string;
  progress: number;
  state: string;
  downloadMbps: number;
  uploadMbps: number;
  etaSeconds: number | null;
}

export interface QBittorrentData {
  status: "online" | "offline" | "unknown";
  configured: boolean;
  downloadMbps: number;
  uploadMbps: number;
  totalDownloadedGb: number;
  totalUploadedGb: number;
  total: number;
  downloading: number;
  seeding: number;
  paused: number;
  errored: number;
  torrents: QBittorrentTorrent[];
  settings: {
    showNames: boolean;
    torrentLimit: number;
    speedUnit: "mbps" | "mbs";
  };
  error?: string;
}

export interface GluetunData {
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

export interface MailMessageSummary {
  id: string;
  from: string;
  subject: string;
  date: string | null;
  unread: boolean;
}

export interface MailData {
  status: "online" | "offline" | "unknown";
  configured: boolean;
  providerName: string;
  mailbox: string;
  unread: number;
  total: number;
  messages: MailMessageSummary[];
  checkedAt: string;
  unreadAlertThreshold?: number;
  openUrl?: string;
  error?: string;
}

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

export interface IntegrationInfo {
  id: IntegrationId;
  name: string;
  status: "configured" | "needs_config" | "available";
  summary: string;
  fields: string[];
  secretFields: string[];
  settings: Record<string, string | number | boolean | DockerSource[]>;
  instructions: string[];
}

export type IntegrationId = "docker" | "plex" | "unifi" | "ollama" | "qbittorrent" | "gluetun" | "mail" | AdditionalIntegrationId;

export interface IntegrationTestResult {
  id: IntegrationId;
  ok: boolean;
  status: "online" | "offline" | "unknown" | string;
  configured: boolean;
  durationMs: number;
  error?: string;
}

export interface IntegrationSettingsInput {
  docker?: {
    socketPath?: string;
    sources?: DockerSourceInput[];
  };
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
  mail?: {
    providerName?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    username?: string;
    password?: string;
    mailbox?: string;
    maxItems?: number;
    unreadAlertThreshold?: number;
    openUrl?: string;
  };
  additional?: Partial<Record<AdditionalIntegrationId, AdditionalIntegrationSettings>>;
}

export interface ServiceIntegrationData {
  id: AdditionalIntegrationId;
  name: string;
  status: "online" | "offline" | "unknown";
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

export interface ServicesStatusData {
  status: "online" | "offline" | "unknown";
  services: ServiceIntegrationData[];
}

export interface HomeAssistantControlOption {
  entityId: string;
  label: string;
  domain: string;
  state: string;
}

export interface HomeAssistantWidgetOptions {
  options: HomeAssistantControlOption[];
  selected: string[];
  showMetrics: boolean;
}
