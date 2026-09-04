import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BookOpen, Bot, Cloud, Command, Container, Database, Download, Film, Home, LayoutDashboard, Network, Server, Workflow } from "lucide-react";
import { api } from "../api";
import type { AdditionalIntegrationId, AppearanceSettings, DashboardLink, DashboardLinkInput, HealthOverviewResponse, IconCatalog, LinkLayout, LinksResponse, RssFeedConfig, RssSettings, ServiceTemplate, WidgetFlags, WidgetId, WidgetLayout, WidgetStyle } from "../types";
import AdditionalServiceWidget from "./AdditionalServiceWidget";
import AssistantWidget from "./AssistantWidget";
import AppearanceSettingsModal from "./AppearanceSettingsModal";
import BackupWidget from "./BackupWidget";
import CommandPalette, { type CommandPaletteCommand } from "./CommandPalette";
import DockerWidget from "./DockerWidget";
import GluetunWidget from "./GluetunWidget";
import IntegrationGuideModal from "./IntegrationGuideModal";
import JournalWidget from "./JournalWidget";
import LinkCard from "./LinkCard";
import MailWidget from "./MailWidget";
import ManagementRail, { type MobileDashboardView, type RailItem } from "./ManagementRail";
import NotificationCenterWidget from "./NotificationCenterWidget";
import NotesWidget from "./NotesWidget";
import OllamaHeaderPulse from "./OllamaHeaderPulse";
import OllamaWidget from "./OllamaWidget";
import PlexWidget from "./PlexWidget";
import PwaReloadButton from "./PwaReloadButton";
import QBittorrentWidget from "./QBittorrentWidget";
import RssFeedsModal from "./RssFeedsModal";
import RssTicker from "./RssTicker";
import RssWidget from "./RssWidget";
import SearchBar from "./SearchBar";
import SearchSettingsModal from "./SearchSettingsModal";
import ServiceFormModal from "./ServiceFormModal";
import ServiceManagerModal from "./ServiceManagerModal";
import TasksWidget from "./TasksWidget";
import TodayWidget from "./TodayWidget";
import UnifiWidget from "./UnifiWidget";
import VoiceAssistant from "./VoiceAssistant";
import { WidgetDisplayProvider } from "./WidgetDisplayContext";
import WidgetOrderModal from "./WidgetOrderModal";

const defaultWidgetOrder: WidgetId[] = [
  "today",
  "tasks",
  "mail",
  "unifi",
  "docker",
  "gluetun",
  "plex",
  "qbittorrent",
  "homeassistant",
  "ollama",
  "assistant",
  "rss",
  "backup",
  "notes",
  "journal",
  "proxmox",
  "truenas",
  "pihole",
  "adguard",
  "uptimekuma",
  "portainer",
  "sonarr",
  "radarr",
  "lidarr",
  "readarr",
  "jellyfin",
  "tautulli",
  "nginxproxymanager",
  "traefik"
];

const additionalWidgetNames: Record<AdditionalIntegrationId, string> = {
  homeassistant: "Home Assistant",
  proxmox: "Proxmox",
  truenas: "TrueNAS",
  pihole: "Pi-hole",
  adguard: "AdGuard Home",
  uptimekuma: "Uptime Kuma",
  portainer: "Portainer",
  sonarr: "Sonarr",
  radarr: "Radarr",
  lidarr: "Lidarr",
  readarr: "Readarr",
  jellyfin: "Jellyfin",
  tautulli: "Tautulli",
  nginxproxymanager: "Nginx Proxy Manager",
  traefik: "Traefik"
};

const linkIconMap = {
  activity: Activity,
  bot: Bot,
  "book-open": BookOpen,
  cloud: Cloud,
  "layout-dashboard": LayoutDashboard,
  database: Database,
  download: Download,
  film: Film,
  home: Home,
  container: Container,
  network: Network,
  server: Server,
  workflow: Workflow
};

const backgroundPresetClasses: Record<string, string> = {
  aurora: "bg-[radial-gradient(circle_at_18%_12%,rgba(95,206,210,0.55),transparent_42%),radial-gradient(circle_at_82%_10%,rgba(232,188,99,0.38),transparent_36%),linear-gradient(145deg,#26313a,#121a22)]",
  ember: "bg-[radial-gradient(circle_at_82%_12%,rgba(245,158,11,0.52),transparent_38%),radial-gradient(circle_at_20%_24%,rgba(103,232,249,0.22),transparent_40%),linear-gradient(145deg,#2a2724,#141b22)]",
  midnight: "bg-[radial-gradient(circle_at_28%_10%,rgba(125,211,252,0.28),transparent_34%),radial-gradient(circle_at_72%_20%,rgba(129,140,248,0.24),transparent_38%),linear-gradient(145deg,#1b2430,#0c121a)]",
  forest: "bg-[radial-gradient(circle_at_16%_18%,rgba(52,211,153,0.34),transparent_38%),radial-gradient(circle_at_84%_8%,rgba(250,204,21,0.22),transparent_34%),linear-gradient(145deg,#1f302c,#101820)]"
};

function linkRailIcon(link: DashboardLink) {
  const className = "h-5 w-5";

  if (link.iconUrl) {
    return <img src={link.iconUrl} alt="" className="h-7 w-7 object-contain" loading="lazy" referrerPolicy="no-referrer" />;
  }

  const Icon = linkIconMap[link.icon as keyof typeof linkIconMap] ?? Server;
  return <Icon className={className} />;
}

export default function Dashboard() {
  const [title, setTitle] = useState("Anya");
  const [links, setLinks] = useState<DashboardLink[]>([]);
  const [widgets, setWidgets] = useState<WidgetFlags>({});
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(defaultWidgetOrder);
  const [mobileWidgetOrder, setMobileWidgetOrder] = useState<WidgetId[]>(defaultWidgetOrder);
  const [widgetLayout, setWidgetLayout] = useState<WidgetLayout>("sidebar");
  const [widgetStyle, setWidgetStyle] = useState<WidgetStyle>("cards");
  const [linkLayout, setLinkLayout] = useState<LinkLayout>("grouped");
  const [searchUrlTemplate, setSearchUrlTemplate] = useState("https://www.google.com/search?q={query}");
  const [searchEngineLabel, setSearchEngineLabel] = useState("Google");
  const [searchVisible, setSearchVisible] = useState(true);
  const [appearance, setAppearance] = useState<AppearanceSettings>({ background: { mode: "default", preset: "aurora", dim: 45, blur: 0 } });
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [iconCatalog, setIconCatalog] = useState<IconCatalog>({ updatedAt: null, items: [] });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [searchSettingsOpen, setSearchSettingsOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [rssFeedsOpen, setRssFeedsOpen] = useState(false);
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<DashboardLink | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [savingWidgets, setSavingWidgets] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [savingRssFeeds, setSavingRssFeeds] = useState(false);
  const [refreshingIcons, setRefreshingIcons] = useState(false);
  const [searchSettingsError, setSearchSettingsError] = useState<string | null>(null);
  const [appearanceError, setAppearanceError] = useState<string | null>(null);
  const [widgetRefreshKey, setWidgetRefreshKey] = useState(0);
  const [ollamaThinking, setOllamaThinking] = useState(false);
  const [healthOverview, setHealthOverview] = useState<HealthOverviewResponse | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileDashboardView>("widgets");

  function applyLinksResponse(data: LinksResponse) {
    setTitle(data.title);
    setLinks(data.links);
    setWidgets(data.widgets);
    setWidgetOrder(data.widgetOrder ?? defaultWidgetOrder);
    setMobileWidgetOrder(data.mobileWidgetOrder ?? data.widgetOrder ?? defaultWidgetOrder);
    setWidgetLayout(data.widgetLayout ?? "sidebar");
    setWidgetStyle(data.widgetStyle ?? "cards");
    setLinkLayout(data.linkLayout ?? "grouped");
    setSearchUrlTemplate(data.search?.urlTemplate || "https://www.google.com/search?q={query}");
    setSearchEngineLabel(data.search?.label || "Google");
    setSearchVisible(data.search?.visible !== false);
    setAppearance(data.appearance ?? { background: { mode: "default", preset: "aurora", dim: 45, blur: 0 } });
    setError(null);
  }

  function loadLinks() {
    setLoading(true);
    api
      .links()
      .then(applyLinksResponse)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  const loadHealthOverview = useCallback(() => {
    api
      .healthOverview()
      .then(setHealthOverview)
      .catch(() => setHealthOverview(null));
  }, []);

  useEffect(() => {
    loadLinks();
    api.templates().then((data) => setTemplates(data.templates)).catch(() => setTemplates([]));
    api.icons().then(setIconCatalog).catch(() => setIconCatalog({ updatedAt: null, items: [] }));
  }, []);

  useEffect(() => {
    loadHealthOverview();
    const interval = window.setInterval(loadHealthOverview, 60_000);

    return () => window.clearInterval(interval);
  }, [loadHealthOverview, widgetRefreshKey]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => setNotice(null), 4000);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  const groupedLinks = useMemo(() => {
    return links.reduce<Record<string, DashboardLink[]>>((groups, link) => {
      groups[link.category] = groups[link.category] ?? [];
      groups[link.category].push(link);
      return groups;
    }, {});
  }, [links]);

  const categories = useMemo(() => {
    return Array.from(new Set(links.map((link) => link.category)));
  }, [links]);

  const searxngUrl = useMemo(() => {
    return links.find((link) => /searxng|searx/i.test(`${link.name} ${link.description}`))?.url;
  }, [links]);

  function closeManagementViews() {
    setManagerOpen(false);
    setIntegrationsOpen(false);
    setSearchSettingsOpen(false);
    setAppearanceOpen(false);
    setRssFeedsOpen(false);
    setWidgetsOpen(false);
  }

  function openManagementView(view: "services" | "widgets" | "integrations" | "rss" | "search" | "appearance") {
    closeManagementViews();

    if (view === "services") {
      setManagerOpen(true);
    } else if (view === "widgets") {
      setWidgetsOpen(true);
    } else if (view === "integrations") {
      setIntegrationsOpen(true);
    } else if (view === "rss") {
      setRssFeedsOpen(true);
    } else if (view === "appearance") {
      setAppearanceError(null);
      setAppearanceOpen(true);
    } else {
      setSearchSettingsOpen(true);
    }
  }

  function openCreateModal() {
    setEditingLink(null);
    setFormError(null);
    closeManagementViews();
    setModalOpen(true);
  }

  function openEditModal(link: DashboardLink) {
    setEditingLink(link);
    setFormError(null);
    closeManagementViews();
    setModalOpen(true);
  }

  async function handleSubmit(input: DashboardLinkInput) {
    setSaving(true);
    setFormError(null);

    try {
      const data = editingLink ? await api.updateLink(editingLink.id, input) : await api.createLink(input);
      applyLinksResponse(data);
      setNotice(editingLink ? `Updated ${input.name}.` : `Added ${input.name}.`);
      setModalOpen(false);
      setEditingLink(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Saving failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(link: DashboardLink) {
    const confirmed = window.confirm(`Delete ${link.name}?`);

    if (!confirmed) {
      return;
    }

    try {
      const data = await api.deleteLink(link.id);
      applyLinksResponse(data);
      setNotice(`Deleted ${link.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleDockerImport() {
    setBusyAction("docker");

    try {
      const host = window.location.hostname;
      const preview = await api.discoverDocker(host);
      const confirmed = window.confirm(
        `Docker discovery found ${preview.suggestions.length} service suggestions. Import new services and skip existing URLs?`
      );

      if (!confirmed) {
        return;
      }

      const data = await api.importDocker(host);
      applyLinksResponse(data);
      setNotice(`Imported ${data.imported} Docker services, skipped ${data.skipped}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Docker discovery failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleHeimdallImport() {
    setBusyAction("heimdall");

    try {
      const preview = await api.previewHeimdall();

      if (preview.error) {
        throw new Error(preview.error);
      }

      const confirmed = window.confirm(
        `Heimdall import found ${preview.items.length} services. Import new services and skip existing URLs?`
      );

      if (!confirmed) {
        return;
      }

      const data = await api.importHeimdall();
      applyLinksResponse(data);
      setNotice(`Imported ${data.imported} Heimdall services, skipped ${data.skipped}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Heimdall import failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRefreshLibrary() {
    setBusyAction("library");
    setError(null);

    try {
      const data = await api.refreshServiceLibrary();
      applyLinksResponse(data);
      await api.icons().then(setIconCatalog).catch(() => undefined);
      setNotice(`Library refreshed: ${data.icons} icons, ${data.updated} services updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Library refresh failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleWidgetOrderSave(order: WidgetId[], mobileOrder: WidgetId[], nextWidgets: WidgetFlags, nextLayout: WidgetLayout, nextStyle: WidgetStyle) {
    setSavingWidgets(true);
    setError(null);

    try {
      const data = await api.updateWidgets(order, mobileOrder, nextWidgets, nextLayout, nextStyle);
      applyLinksResponse(data);
      setWidgetsOpen(false);
      setNotice("Widget settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Widget order save failed");
    } finally {
      setSavingWidgets(false);
    }
  }

  async function handleSearchSettingsSave(settings: { label?: string; urlTemplate?: string; visible?: boolean }) {
    setSavingSearch(true);
    setSearchSettingsError(null);

    try {
      const data = await api.updateSearch(settings);
      applyLinksResponse(data);
      setSearchSettingsOpen(false);
      setNotice("Search settings saved.");
    } catch (err) {
      setSearchSettingsError(err instanceof Error ? err.message : "Search settings save failed");
    } finally {
      setSavingSearch(false);
    }
  }

  async function handleAppearanceSave(settings: AppearanceSettings) {
    setSavingAppearance(true);
    setAppearanceError(null);

    try {
      const data = await api.updateAppearance(settings);
      applyLinksResponse(data);
      setAppearanceOpen(false);
      setNotice("Appearance saved.");
    } catch (err) {
      setAppearanceError(err instanceof Error ? err.message : "Appearance save failed");
    } finally {
      setSavingAppearance(false);
    }
  }

  async function handleBackgroundUpload(file: File) {
    setAppearanceError(null);

    try {
      const result = await api.uploadBackground(file);
      return result.imageUrl;
    } catch (err) {
      setAppearanceError(err instanceof Error ? err.message : "Background upload failed");
      throw err;
    }
  }

  async function handleRssFeedsSave(rssFeeds: RssFeedConfig[], rssSettings: RssSettings) {
    setSavingRssFeeds(true);
    setError(null);

    try {
      const data = await api.updateRssFeeds(rssFeeds, rssSettings);
      applyLinksResponse(data);
      setRssFeedsOpen(false);
      setWidgetRefreshKey((current) => current + 1);
      window.setTimeout(() => setWidgetRefreshKey((current) => current + 1), 1000);
      setNotice("RSS feeds saved. Widget refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "RSS feed save failed");
      throw err;
    } finally {
      setSavingRssFeeds(false);
    }
  }

  async function handleRefreshIcons() {
    setRefreshingIcons(true);
    setFormError(null);

    try {
      const catalog = await api.refreshIcons();
      setIconCatalog(catalog);
      setNotice(`Icon library refreshed: ${catalog.items.length} icons.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Icon library refresh failed");
    } finally {
      setRefreshingIcons(false);
    }
  }

  async function handleLinkOrderSave(ids: string[]) {
    setError(null);

    try {
      const data = await api.updateLinkOrder(ids);
      applyLinksResponse(data);
      setNotice("Service order saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Service order save failed");
    }
  }

  async function handleLinkLayoutSave(layout: LinkLayout) {
    setError(null);

    try {
      const data = await api.updateLinkLayout(layout);
      applyLinksResponse(data);
      setNotice(layout === "grouped" ? "Grouped service view enabled." : "Single grid service view enabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Service view save failed");
    }
  }

  function renderWidget(widget: WidgetId) {
    if (!widgets[widget]) {
      return null;
    }

    const coreComponents: Partial<Record<WidgetId, React.ReactNode>> = {
      unifi: <UnifiWidget refreshKey={widgetRefreshKey} />,
      plex: <PlexWidget refreshKey={widgetRefreshKey} />,
      docker: <DockerWidget refreshKey={widgetRefreshKey} />,
      gluetun: <GluetunWidget refreshKey={widgetRefreshKey} />,
      qbittorrent: <QBittorrentWidget refreshKey={widgetRefreshKey} />,
      ollama: <OllamaWidget refreshKey={widgetRefreshKey} onThinkingChange={setOllamaThinking} />,
      assistant: <AssistantWidget refreshKey={widgetRefreshKey} />,
      rss: <RssWidget refreshKey={widgetRefreshKey} />,
      backup: <BackupWidget refreshKey={widgetRefreshKey} />,
      notes: <NotesWidget refreshKey={widgetRefreshKey} />,
      journal: <JournalWidget refreshKey={widgetRefreshKey} />,
      today: <TodayWidget refreshKey={widgetRefreshKey} />,
      tasks: <TasksWidget refreshKey={widgetRefreshKey} />,
      mail: <MailWidget refreshKey={widgetRefreshKey} />
    };

    if (coreComponents[widget]) {
      return <div key={widget} className="min-w-0">{coreComponents[widget]}</div>;
    }

    if (widget in additionalWidgetNames) {
      return (
        <div key={widget} className="min-w-0">
          <AdditionalServiceWidget
            serviceId={widget as AdditionalIntegrationId}
            title={additionalWidgetNames[widget as AdditionalIntegrationId]}
            refreshKey={widgetRefreshKey}
          />
        </div>
      );
    }

    return null;
  }

  const visibleWidgetIds = widgetOrder.filter((widget) => Boolean(widgets[widget]));
  const visibleWidgets = visibleWidgetIds.map(renderWidget).filter(Boolean);
  const mobileWidgetIds = mobileWidgetOrder
    .filter((widget) => Boolean(widgets[widget]));
  const mobileWidgets = mobileWidgetIds.map(renderWidget).filter(Boolean);
  const activeMobileView = mobileView;
  const dashboardMood = healthOverview?.overallStatus ?? "unknown";
  const appRailItems: RailItem[] = links.map((link) => ({
    id: link.id,
    label: link.name,
    icon: linkRailIcon(link)
  }));

  function openRailApp(id: string) {
    const link = links.find((item) => item.id === id);

    if (link) {
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
  }

  const refreshAllWidgets = useCallback(() => {
    setWidgetRefreshKey((current) => current + 1);
    loadHealthOverview();
    setNotice("Widgets refreshed.");
  }, [loadHealthOverview]);

  function findServiceUrl(patterns: RegExp[]) {
    return links.find((link) => patterns.some((pattern) => pattern.test(`${link.name} ${link.description} ${link.category}`)))?.url;
  }

  function openUrl(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const commandPaletteCommands = useMemo<CommandPaletteCommand[]>(() => {
    function openCommand(id: string, label: string, patterns: RegExp[]): CommandPaletteCommand {
      const url = findServiceUrl(patterns);

      return {
        id,
        label,
        description: url ? "Open service" : "Not configured",
        keywords: patterns.map((pattern) => pattern.source),
        disabled: !url,
        run: () => {
          if (url) {
            openUrl(url);
          }
        }
      };
    }

    // TODO: Wire future safe backend actions here, such as Docker logs or Plex library scan.
    // Avoid destructive actions until Anya has explicit auth and confirmation flows.
    return [
      openCommand("open-plex", "Open Plex", [/plex/i]),
      openCommand("open-portainer", "Open Portainer", [/portainer/i]),
      openCommand("open-unifi", "Open UniFi", [/unifi|ui network/i]),
      openCommand("open-homeassistant", "Open Home Assistant", [/home assistant|homeassistant/i]),
      openCommand("open-qbittorrent", "Open qBittorrent", [/qbittorrent|qbit/i]),
      openCommand("open-ollama", "Open Ollama", [/ollama|openwebui|open webui/i]),
      {
        id: "refresh-widgets",
        label: "Refresh all widgets",
        description: "Reload widget data and health overview",
        keywords: ["reload", "refresh"],
        run: refreshAllWidgets
      },
      {
        id: "open-settings",
        label: "Open settings",
        description: "Manage widgets and integrations",
        keywords: ["settings", "widgets", "integrations"],
        run: () => openManagementView("widgets")
      }
    ];
  }, [links, refreshAllWidgets]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function submitWebSearch() {
    const query = search.trim();

    if (!query) {
      return;
    }

    const looksLikeUrl = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}($|[/:?#])/i.test(query);
    const target = looksLikeUrl
      ? query.startsWith("http://") || query.startsWith("https://")
        ? query
        : `https://${query}`
      : searchUrlTemplate.replace("{query}", encodeURIComponent(query));

    window.open(target, "_blank", "noopener,noreferrer");
    setSearch("");
  }

  const hasImageBackground = appearance.background?.mode === "custom" || appearance.background?.mode === "preset";

  return (
    <main className={`dashboard-shell mood-${dashboardMood} ${hasImageBackground ? "has-image-background" : ""} relative isolate min-h-screen overflow-x-hidden text-slate-100`}>
      <div className="dashboard-mood-bg fixed inset-0 -z-10" />
      <DashboardBackground appearance={appearance} />
      <div className="fixed inset-x-0 bottom-0 -z-10 h-1/2 bg-[radial-gradient(circle_at_56%_100%,rgba(231,166,82,0.11),transparent_32rem)]" />
      <ManagementRail
        busyAction={busyAction}
        mode={widgetLayout === "rail" ? "apps" : "management"}
        railItems={appRailItems}
        activeItem={null}
        mobileView={activeMobileView}
        onRailItemSelect={openRailApp}
        onMobileViewChange={setMobileView}
        onServices={() => openManagementView("services")}
        onWidgets={() => openManagementView("widgets")}
        onIntegrations={() => openManagementView("integrations")}
        onRss={() => openManagementView("rss")}
        onSearch={() => openManagementView("search")}
        onAppearance={() => openManagementView("appearance")}
        onDockerImport={handleDockerImport}
        onHeimdallImport={handleHeimdallImport}
        onRefreshLibrary={handleRefreshLibrary}
        onAddService={openCreateModal}
      />
      <NotificationCenterWidget refreshKey={widgetRefreshKey} />
      <PwaReloadButton />
      <div className="dashboard-content relative mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4 px-4 pb-24 pt-5 sm:gap-5 sm:px-6 lg:pl-28 lg:pr-8 lg:pb-5">
        {widgets.rssTicker ? <RssTicker refreshKey={widgetRefreshKey} /> : null}

        {searchVisible ? (
          <header className="search-shell grid gap-3 rounded-xl border border-white/10 bg-[#25313b]/80 p-3 shadow-glow backdrop-blur sm:p-4 lg:grid-cols-[1fr_minmax(320px,620px)_1fr] lg:items-center">
            <div className="hidden lg:block" />
            <div className="w-full">
              <OllamaHeaderPulse active={ollamaThinking} />
              <SearchBar value={search} onChange={setSearch} onSubmit={submitWebSearch} engineLabel={searchEngineLabel} />
              {widgets.assistant || widgets.ollama ? <VoiceAssistant /> : null}
            </div>
            <div className="hidden justify-end lg:flex">
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-amber-200/30 hover:text-amber-100"
              >
                <Command className="h-4 w-4" />
                Ctrl K
              </button>
            </div>
          </header>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#25313b]/80 px-3 py-2 text-sm font-semibold text-slate-300 shadow-glow backdrop-blur transition hover:border-amber-200/30 hover:text-amber-100"
            >
              <Command className="h-4 w-4" />
              Ctrl K
            </button>
          </div>
        )}

        {error ? (
          <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            {notice}
          </div>
        ) : null}

        <section className="lg:hidden">
          {activeMobileView === "widgets" ? (
            <WidgetDisplayProvider style={widgetStyle}>
              <div className="space-y-4 [&>div]:min-w-0">
                {mobileWidgets.length ? mobileWidgets : (
                  <div className="rounded-xl border border-white/10 bg-slate-950/50 p-8 text-center text-slate-400">
                    No widgets enabled.
                  </div>
                )}
              </div>
            </WidgetDisplayProvider>
          ) : null}

          {activeMobileView === "apps" ? (
            <div className="space-y-5">
              {linkLayout === "grouped" ? (
                Object.entries(groupedLinks).map(([category, categoryLinks]) => (
                  <div key={category} className="min-w-0">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{category}</h2>
                      <span className="text-xs text-slate-500">{categoryLinks.length}</span>
                    </div>
                    <div className="grid min-w-0 gap-3 [&>a]:min-w-0">
                      {categoryLinks.map((link) => (
                        <LinkCard key={link.id} link={link} />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="grid min-w-0 gap-3 [&>a]:min-w-0">
                  {links.map((link) => (
                    <LinkCard key={link.id} link={link} />
                  ))}
                </div>
              )}
              {loading ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/50 p-8 text-center text-slate-400">
                  Loading services...
                </div>
              ) : null}
              {!loading && !error && !links.length ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/50 p-8 text-center text-slate-400">
                  No services yet.
                </div>
              ) : null}
              {!loading && error && !links.length ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/50 p-8 text-center text-slate-400">
                  Services could not be loaded.
                </div>
              ) : null}
            </div>
          ) : null}

        </section>

        <div className="hidden lg:block">
          {widgetLayout === "center" && visibleWidgets.length ? (
            <WidgetDisplayProvider style={widgetStyle}>
              <section className={widgetStyle === "compact" ? "grid min-w-0 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>div]:h-full [&>div]:min-w-0" : widgetStyle === "dense" ? "grid min-w-0 auto-rows-fr grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 [&>div]:h-full [&>div]:min-w-0" : "grid min-w-0 auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 [&>div]:h-full [&>div]:min-w-0"}>
                {visibleWidgets}
              </section>
            </WidgetDisplayProvider>
          ) : null}

          {widgetLayout === "rail" && visibleWidgets.length ? (
            <WidgetDisplayProvider style={widgetStyle}>
              <section className={widgetStyle === "compact" ? "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>div]:min-w-0 [&>div>section]:h-40 [&>div>section]:overflow-y-auto" : widgetStyle === "dense" ? "grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 [&>div]:min-w-0 [&>div>section]:h-[26rem] [&>div>section]:overflow-y-auto" : "grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 [&>div]:min-w-0 [&>div>section]:h-auto [&>div>section]:overflow-hidden md:[&>div>section]:h-[32rem] md:[&>div>section]:overflow-y-auto"}>
                {visibleWidgets}
              </section>
            </WidgetDisplayProvider>
          ) : null}

          <div className={widgetLayout === "sidebar" ? "grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_390px]" : "grid min-w-0 gap-6"}>
            {widgetLayout !== "rail" ? (
              <section className="min-w-0 space-y-5">
                {linkLayout === "grouped" ? (
                  Object.entries(groupedLinks).map(([category, categoryLinks]) => (
                    <div key={category} className="min-w-0">
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{category}</h2>
                        <span className="text-xs text-slate-500">{categoryLinks.length}</span>
                      </div>
                      <div className={widgetLayout === "sidebar" ? "grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>a]:min-w-0" : "grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>a]:min-w-0"}>
                        {categoryLinks.map((link) => (
                          <LinkCard
                            key={link.id}
                            link={link}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={widgetLayout === "sidebar" ? "grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>a]:min-w-0" : "grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>a]:min-w-0"}>
                    {links.map((link) => (
                      <LinkCard
                        key={link.id}
                        link={link}
                      />
                    ))}
                  </div>
                )}
                {loading ? (
                  <div className="rounded-xl border border-white/10 bg-slate-950/50 p-8 text-center text-slate-400">
                    Loading services...
                  </div>
                ) : null}
                {!loading && !error && !links.length ? (
                  <div className="rounded-xl border border-white/10 bg-slate-950/50 p-8 text-center text-slate-400">
                    No services yet.
                  </div>
                ) : null}
                {!loading && error && !links.length ? (
                  <div className="rounded-xl border border-white/10 bg-slate-950/50 p-8 text-center text-slate-400">
                    Services could not be loaded.
                  </div>
                ) : null}
              </section>
            ) : null}

            {widgetLayout === "sidebar" ? (
              <WidgetDisplayProvider style={widgetStyle}>
                <aside className={widgetStyle === "compact" ? "grid min-w-0 content-start gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 [&>div]:min-w-0" : widgetStyle === "dense" ? "min-w-0 space-y-3 [&>div]:min-w-0" : "min-w-0 space-y-4 [&>div]:min-w-0"}>
                  {visibleWidgets}
                </aside>
              </WidgetDisplayProvider>
            ) : null}
          </div>
        </div>
      </div>
      <CommandPalette
        open={commandPaletteOpen}
        commands={commandPaletteCommands}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <ServiceFormModal
        categories={categories}
        templates={templates}
        iconCatalog={iconCatalog}
        error={formError}
        link={editingLink}
        open={modalOpen}
        saving={saving}
        refreshingIcons={refreshingIcons}
        onClose={() => {
          setModalOpen(false);
          setEditingLink(null);
          setFormError(null);
        }}
        onSubmit={handleSubmit}
        onRefreshIcons={handleRefreshIcons}
      />
      <ServiceManagerModal
        links={links}
        open={managerOpen}
        busyAction={busyAction}
        linkLayout={linkLayout}
        onClose={() => setManagerOpen(false)}
        onCreate={openCreateModal}
        onEdit={openEditModal}
        onDelete={handleDelete}
        onDockerImport={handleDockerImport}
        onHeimdallImport={handleHeimdallImport}
        onRefreshLibrary={handleRefreshLibrary}
        onReorder={handleLinkOrderSave}
        onLinkLayoutChange={handleLinkLayoutSave}
      />
      <SearchSettingsModal
        open={searchSettingsOpen}
        search={{ label: searchEngineLabel, urlTemplate: searchUrlTemplate, visible: searchVisible }}
        defaultSearxngUrl={searxngUrl}
        saving={savingSearch}
        error={searchSettingsError}
        onClose={() => {
          setSearchSettingsOpen(false);
          setSearchSettingsError(null);
        }}
        onSave={handleSearchSettingsSave}
      />
      <AppearanceSettingsModal
        open={appearanceOpen}
        appearance={appearance}
        saving={savingAppearance}
        error={appearanceError}
        onClose={() => {
          setAppearanceOpen(false);
          setAppearanceError(null);
        }}
        onSave={handleAppearanceSave}
        onUpload={handleBackgroundUpload}
      />
      <RssFeedsModal
        open={rssFeedsOpen}
        saving={savingRssFeeds}
        onClose={() => setRssFeedsOpen(false)}
        onSave={handleRssFeedsSave}
      />
      <IntegrationGuideModal
        open={integrationsOpen}
        onClose={() => setIntegrationsOpen(false)}
        onSaved={() => {
          setWidgetRefreshKey((current) => current + 1);
          setNotice("Integrations saved. Widgets refreshed.");
        }}
      />
      <WidgetOrderModal
        open={widgetsOpen}
        widgets={widgets}
        widgetOrder={widgetOrder}
        mobileWidgetOrder={mobileWidgetOrder}
        widgetLayout={widgetLayout}
        widgetStyle={widgetStyle}
        saving={savingWidgets}
        onClose={() => setWidgetsOpen(false)}
        onConfigure={() => {
          setWidgetsOpen(false);
          setIntegrationsOpen(true);
        }}
        onRefresh={() => {
          setWidgetRefreshKey((current) => current + 1);
          setNotice("Widgets refreshed.");
        }}
        onSave={handleWidgetOrderSave}
      />
    </main>
  );
}

function DashboardBackground({ appearance }: { appearance: AppearanceSettings }) {
  const background = appearance.background;

  if (!background || background.mode === "default") {
    return null;
  }

  const dim = Math.min(0.9, Math.max(0, (background.dim ?? 45) / 100));
  const blur = Math.min(18, Math.max(0, background.blur ?? 0));
  const layerStyle: React.CSSProperties = {
    filter: blur ? `blur(${blur}px)` : undefined,
    transform: blur ? "scale(1.04)" : undefined
  };

  return (
    <>
      {background.mode === "custom" && background.imageUrl ? (
        <div
          className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
          style={{
            ...layerStyle,
            backgroundImage: `url(${background.imageUrl})`
          }}
        />
      ) : (
        <div
          className={`pointer-events-none fixed inset-0 -z-10 ${backgroundPresetClasses[background.preset ?? "aurora"] ?? backgroundPresetClasses.aurora}`}
          style={layerStyle}
        />
      )}
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundColor: `rgba(2, 6, 23, ${dim})` }} />
    </>
  );
}
