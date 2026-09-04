import type {
  DashboardLinkInput,
  AssistantAskResponse,
  AppearanceSettings,
  BackupStatusResponse,
  DockerData,
  GluetunData,
  HealthOverviewResponse,
  HomeAssistantWidgetOptions,
  IconCatalog,
  ImportResponse,
  IntegrationId,
  IntegrationInfo,
  IntegrationSettingsInput,
  IntegrationTestResult,
  JournalEntry,
  JournalEntryInput,
  LinkLayout,
  MailData,
  LibraryRefreshResponse,
  LinksResponse,
  Note,
  NoteInput,
  OllamaAskResponse,
  OllamaData,
  OllamaMessage,
  NotificationsResponse,
  PlexData,
  QBittorrentData,
  RssFeedConfig,
  RssResponse,
  RssSettings,
  SearchSettings,
  ServiceIntegrationData,
  ServiceStatus,
  ServicesStatusData,
  ServiceTemplate,
  ReminderInput,
  ReminderItem,
  TaskInput,
  TaskItem,
  TodayOverview,
  WidgetFlags,
  WidgetLayout,
  WidgetStyle,
  UnifiData,
  WidgetId
} from "./types";

function getApiBase() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (typeof window === "undefined") {
    return "/api";
  }

  return new URL("/api", window.location.origin).toString().replace(/\/+$/, "");
}

const API_BASE = getApiBase();

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...init?.headers
      },
      ...init
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new Error(`API request failed for ${url}: ${message}`);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.status === 504) {
      throw new Error("Ollama request timed out. The model may still be generating, so try again or use a shorter prompt.");
    }
    throw new Error(payload?.error ?? `API request failed for ${url}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function uploadFileJson<T>(path: string, file: File): Promise<T> {
  const url = `${API_BASE}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": file.type,
        "Cache-Control": "no-cache"
      },
      body: file
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new Error(`API request failed for ${url}: ${message}`);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `API request failed for ${url}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function streamAssistantAnswer(
  question: string,
  onChunk: (chunk: string) => void,
  onDone?: (meta: { sources?: string[]; checkedAt?: string }) => void,
  sessionId?: string
) {
  const response = await fetch(`${API_BASE}/assistant/ask/stream`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache"
    },
    body: JSON.stringify({ question, sessionId })
  });

  if (!response.ok) {
    let message = `API request failed for ${response.url}: ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Keep the status-based error.
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Assistant stream is not available");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      const payload = JSON.parse(trimmed) as { type?: string; content?: string; error?: string; sources?: string[]; checkedAt?: string };
      if (payload.type === "chunk" && payload.content) {
        onChunk(payload.content);
      } else if (payload.type === "done") {
        onDone?.({ sources: payload.sources, checkedAt: payload.checkedAt });
      } else if (payload.type === "error") {
        throw new Error(payload.error || "Assistant stream failed");
      }
    }
  }
}

export async function requestAssistantSpeech(text: string) {
  const response = await fetch(`${API_BASE}/assistant/tts`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache"
    },
    body: JSON.stringify({ text })
  });

  if (response.status === 202) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status}`);
  }

  return URL.createObjectURL(await response.blob());
}

export const api = {
  links: () => requestJson<LinksResponse>("/links"),
  createLink: (link: DashboardLinkInput) =>
    requestJson<LinksResponse>("/links", { method: "POST", body: JSON.stringify(link) }),
  updateLink: (id: string, link: DashboardLinkInput) =>
    requestJson<LinksResponse>(`/links/${id}`, { method: "PUT", body: JSON.stringify(link) }),
  deleteLink: (id: string) => requestJson<LinksResponse>(`/links/${id}`, { method: "DELETE" }),
  updateLinkOrder: (ids: string[]) =>
    requestJson<LinksResponse>("/links/order", { method: "PUT", body: JSON.stringify({ ids }) }),
  updateLinkLayout: (layout: LinkLayout) =>
    requestJson<LinksResponse>("/links/layout", { method: "PUT", body: JSON.stringify({ layout }) }),
  templates: () => requestJson<{ templates: ServiceTemplate[] }>("/templates"),
  icons: () => requestJson<IconCatalog>("/icons"),
  refreshIcons: () => requestJson<IconCatalog>("/icons/refresh", { method: "POST" }),
  refreshServiceLibrary: () => requestJson<LibraryRefreshResponse>("/services/refresh-library", { method: "POST" }),
  integrations: () => requestJson<{ integrations: IntegrationInfo[] }>("/integrations"),
  updateIntegrations: (input: IntegrationSettingsInput) =>
    requestJson<{ integrations: IntegrationInfo[] }>("/integrations", { method: "PUT", body: JSON.stringify(input) }),
  deleteIntegration: (id: IntegrationId) =>
    requestJson<{ integrations: IntegrationInfo[] }>(`/integrations/${id}`, { method: "DELETE" }),
  testIntegration: (id: IntegrationId) =>
    requestJson<IntegrationTestResult>(`/integrations/${id}/test`, { method: "POST" }),
  updateWidgets: (order: WidgetId[], mobileOrder: WidgetId[], widgets: WidgetFlags, layout: WidgetLayout, style: WidgetStyle) =>
    requestJson<LinksResponse>("/widgets", { method: "PUT", body: JSON.stringify({ order, mobileOrder, widgets, layout, style }) }),
  updateSearch: (search: SearchSettings) =>
    requestJson<LinksResponse>("/search", { method: "PUT", body: JSON.stringify(search) }),
  appearance: () => requestJson<{ appearance: AppearanceSettings }>("/appearance"),
  updateAppearance: (appearance: AppearanceSettings) =>
    requestJson<LinksResponse>("/appearance", { method: "PUT", body: JSON.stringify(appearance) }),
  uploadBackground: (file: File) =>
    uploadFileJson<{ imageUrl: string }>("/appearance/background", file),
  updateWidgetOrder: (order: WidgetId[]) =>
    requestJson<LinksResponse>("/widgets/order", { method: "PUT", body: JSON.stringify({ order }) }),
  statuses: () => requestJson<{ statuses: ServiceStatus[] }>("/status"),
  discoverDocker: (host: string) => requestJson<{ suggestions: DashboardLinkInput[] }>(`/discover/docker?host=${encodeURIComponent(host)}`),
  importDocker: (host: string) =>
    requestJson<ImportResponse>("/discover/docker/import", { method: "POST", body: JSON.stringify({ host }) }),
  previewHeimdall: () => requestJson<{ configured: boolean; items: DashboardLinkInput[]; skipped: number; error?: string }>("/import/heimdall/preview"),
  importHeimdall: () => requestJson<ImportResponse>("/import/heimdall", { method: "POST" }),
  rss: (refresh = false) => requestJson<RssResponse>(refresh ? "/rss?refresh=1" : "/rss"),
  refreshRss: () => requestJson<RssResponse>("/rss/refresh", { method: "POST" }),
  rssFeeds: () => requestJson<{ rssFeeds: RssFeedConfig[]; rssSettings: RssSettings }>("/rss/feeds"),
  updateRssFeeds: (rssFeeds: RssFeedConfig[], rssSettings: RssSettings) =>
    requestJson<LinksResponse>("/rss/feeds", { method: "PUT", body: JSON.stringify({ rssFeeds, rssSettings }) }),
  healthOverview: () => requestJson<HealthOverviewResponse>("/health/overview"),
  notifications: () => requestJson<NotificationsResponse>("/notifications"),
  notificationHistory: () => requestJson<NotificationsResponse>("/notifications/history"),
  acknowledgeNotification: (id: string) =>
    requestJson<{ ok: true }>(`/notifications/${id}/ack`, { method: "POST" }),
  acknowledgeAllNotifications: () =>
    requestJson<{ ok: true }>("/notifications/ack-all", { method: "POST" }),
  backupStatus: () => requestJson<BackupStatusResponse>("/backup"),
  runBackup: () => requestJson<BackupStatusResponse>("/backup/run", { method: "POST" }),
  verifyBackup: (id?: string) =>
    requestJson<BackupStatusResponse>("/backup/verify", { method: "POST", body: JSON.stringify({ id }) }),
  notes: (query?: string) =>
    requestJson<{ notes: Note[] }>(query ? `/notes?q=${encodeURIComponent(query)}` : "/notes"),
  createNote: (note: NoteInput) =>
    requestJson<{ note: Note }>("/notes", { method: "POST", body: JSON.stringify(note) }),
  updateNote: (id: string, note: NoteInput) =>
    requestJson<{ note: Note }>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(note) }),
  deleteNote: (id: string) =>
    requestJson<{ ok: true }>(`/notes/${id}`, { method: "DELETE" }),
  journal: (query?: string) =>
    requestJson<{ entries: JournalEntry[] }>(query ? `/journal?q=${encodeURIComponent(query)}` : "/journal"),
  createJournalEntry: (entry: JournalEntryInput) =>
    requestJson<{ entry: JournalEntry }>("/journal", { method: "POST", body: JSON.stringify(entry) }),
  updateJournalEntry: (id: string, entry: JournalEntryInput) =>
    requestJson<{ entry: JournalEntry }>(`/journal/${id}`, { method: "PUT", body: JSON.stringify(entry) }),
  deleteJournalEntry: (id: string) =>
    requestJson<{ ok: true }>(`/journal/${id}`, { method: "DELETE" }),
  today: () => requestJson<TodayOverview>("/today"),
  tasks: (query?: string) =>
    requestJson<{ tasks: TaskItem[] }>(query ? `/tasks?q=${encodeURIComponent(query)}` : "/tasks"),
  createTask: (task: TaskInput) =>
    requestJson<{ task: TaskItem }>("/tasks", { method: "POST", body: JSON.stringify(task) }),
  updateTask: (id: string, task: TaskInput) =>
    requestJson<{ task: TaskItem }>(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(task) }),
  deleteTask: (id: string) =>
    requestJson<{ ok: true }>(`/tasks/${id}`, { method: "DELETE" }),
  reminders: (query?: string) =>
    requestJson<{ reminders: ReminderItem[] }>(query ? `/reminders?q=${encodeURIComponent(query)}` : "/reminders"),
  createReminder: (reminder: ReminderInput) =>
    requestJson<{ reminder: ReminderItem }>("/reminders", { method: "POST", body: JSON.stringify(reminder) }),
  updateReminder: (id: string, reminder: ReminderInput) =>
    requestJson<{ reminder: ReminderItem }>(`/reminders/${id}`, { method: "PUT", body: JSON.stringify(reminder) }),
  deleteReminder: (id: string) =>
    requestJson<{ ok: true }>(`/reminders/${id}`, { method: "DELETE" }),
  unifi: () => requestJson<UnifiData>("/unifi"),
  plex: () => requestJson<PlexData>("/plex"),
  qbittorrent: () => requestJson<QBittorrentData>("/qbittorrent"),
  gluetun: () => requestJson<GluetunData>("/gluetun"),
  mail: () => requestJson<MailData>("/mail"),
  docker: () => requestJson<DockerData>("/docker"),
  servicesStatus: () => requestJson<ServicesStatusData>("/services-status"),
  homeAssistantOptions: () => requestJson<HomeAssistantWidgetOptions>("/services/homeassistant/options"),
  serviceAction: (id: IntegrationId, entityId: string) =>
    requestJson<ServiceIntegrationData>(`/services/${id}/action`, { method: "POST", body: JSON.stringify({ entityId }) }),
  ollama: () => requestJson<OllamaData>("/ollama"),
  askOllama: (prompt: string, model?: string, messages?: OllamaMessage[]) =>
    requestJson<OllamaAskResponse>("/ollama/ask", { method: "POST", body: JSON.stringify({ prompt, model, messages }) }),
  askAssistant: (question: string, sessionId?: string) =>
    requestJson<AssistantAskResponse>("/assistant/ask", { method: "POST", body: JSON.stringify({ question, sessionId }) })
};
