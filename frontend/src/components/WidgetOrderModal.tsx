import { Activity, ArrowDown, ArrowUp, BookOpen, BookText, Bot, Boxes, CalendarCheck, CheckCircle2, DatabaseBackup, Download, Film, Gauge, HardDrive, Home, Mail, Network, RadioTower, RefreshCw, Rss, Save, Search, Server, Settings2, Shield, Tv, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AdditionalIntegrationId, WidgetFlags, WidgetId, WidgetLayout, WidgetStyle } from "../types";

interface WidgetOrderModalProps {
  open: boolean;
  widgets: WidgetFlags;
  widgetOrder: WidgetId[];
  mobileWidgetOrder: WidgetId[];
  widgetLayout: WidgetLayout;
  widgetStyle: WidgetStyle;
  saving: boolean;
  onClose: () => void;
  onConfigure: () => void;
  onRefresh: () => void;
  onSave: (order: WidgetId[], mobileOrder: WidgetId[], widgets: WidgetFlags, layout: WidgetLayout, style: WidgetStyle) => Promise<void>;
}

const coreWidgetDetails: Record<Exclude<WidgetId, AdditionalIntegrationId>, {
  label: string;
  description: string;
  integration: string;
  icon: typeof Network;
}> = {
  today: {
    label: "Today",
    description: "Daily overview from notes, journal and backup status.",
    integration: "Private Anya data",
    icon: CalendarCheck
  },
  tasks: {
    label: "Tasks",
    description: "Private tasks and reminders stored locally.",
    integration: "Private Anya data",
    icon: CheckCircle2
  },
  mail: {
    label: "Mail",
    description: "Read-only IMAP inbox overview with unread count and recent headers.",
    integration: "IMAP credentials required",
    icon: Mail
  },
  unifi: {
    label: "UniFi Network",
    description: "Access points, cameras, clients, latency and current traffic.",
    integration: "UniFi credentials required",
    icon: Network
  },
  plex: {
    label: "Plex",
    description: "Active sessions, library totals and recently added posters.",
    integration: "Plex URL and token required",
    icon: Film
  },
  docker: {
    label: "Docker",
    description: "Container totals from one or multiple Docker sources.",
    integration: "Docker sources required",
    icon: Boxes
  },
  gluetun: {
    label: "VPN Shield",
    description: "Checks the public IP from inside your Gluetun container.",
    integration: "Docker source and Gluetun container required",
    icon: Shield
  },
  qbittorrent: {
    label: "qBittorrent",
    description: "Transfer speeds, torrent counts and active torrents.",
    integration: "qBittorrent Web UI credentials required",
    icon: Download
  },
  ollama: {
    label: "Ollama",
    description: "Ask your local model directly from the dashboard.",
    integration: "Ollama URL and model required",
    icon: Bot
  },
  assistant: {
    label: "Anya Assistant",
    description: "Asks Ollama using safe dashboard context from your homelab widgets.",
    integration: "Uses the Ollama integration",
    icon: Bot
  },
  rss: {
    label: "RSS Radar",
    description: "Latest feed items from dashboard RSS sources.",
    integration: "Uses RSS feeds from dashboard config",
    icon: Rss
  },
  backup: {
    label: "Backup",
    description: "Manual local backup status for Anya config and private data.",
    integration: "Uses local config/backups or BACKUP_PATH",
    icon: DatabaseBackup
  },
  notes: {
    label: "Notes",
    description: "Private local notes stored in Anya's SQLite database.",
    integration: "Private Anya data",
    icon: BookOpen
  },
  journal: {
    label: "Journal",
    description: "Private dated journal entries with optional mood.",
    integration: "Private Anya data",
    icon: BookText
  }
};

const additionalWidgetDetails: Record<AdditionalIntegrationId, {
  label: string;
  description: string;
  integration: string;
  icon: typeof Network;
}> = {
  homeassistant: {
    label: "Home Assistant",
    description: "Entities, unavailable devices and smart home health.",
    integration: "Home Assistant token required",
    icon: Home
  },
  proxmox: {
    label: "Proxmox",
    description: "Nodes, VMs, LXCs and cluster resource totals.",
    integration: "Proxmox API token required",
    icon: Server
  },
  truenas: {
    label: "TrueNAS",
    description: "Pool health and storage status.",
    integration: "TrueNAS API key required",
    icon: HardDrive
  },
  pihole: {
    label: "Pi-hole",
    description: "DNS queries, blocked requests and block percentage.",
    integration: "Pi-hole URL and optional API token",
    icon: Shield
  },
  adguard: {
    label: "AdGuard Home",
    description: "Protection status, DNS queries and blocked requests.",
    integration: "AdGuard credentials required",
    icon: Shield
  },
  uptimekuma: {
    label: "Uptime Kuma",
    description: "Public status page monitor health.",
    integration: "Status page slug required",
    icon: Activity
  },
  portainer: {
    label: "Portainer",
    description: "Endpoint and container management status.",
    integration: "Portainer API key required",
    icon: Boxes
  },
  sonarr: {
    label: "Sonarr",
    description: "System status and health warnings.",
    integration: "Sonarr API key required",
    icon: Tv
  },
  radarr: {
    label: "Radarr",
    description: "System status and health warnings.",
    integration: "Radarr API key required",
    icon: Film
  },
  lidarr: {
    label: "Lidarr",
    description: "System status and health warnings.",
    integration: "Lidarr API key required",
    icon: RadioTower
  },
  readarr: {
    label: "Readarr",
    description: "System status and health warnings.",
    integration: "Readarr API key required",
    icon: Rss
  },
  jellyfin: {
    label: "Jellyfin",
    description: "Server status and item counts.",
    integration: "Jellyfin API key required",
    icon: Film
  },
  tautulli: {
    label: "Tautulli",
    description: "Plex activity and library stats from Tautulli.",
    integration: "Tautulli API key required",
    icon: Gauge
  },
  nginxproxymanager: {
    label: "Nginx Proxy Manager",
    description: "Proxy hosts and SSL certificate status.",
    integration: "NPM credentials required",
    icon: Network
  },
  traefik: {
    label: "Traefik",
    description: "Routers, services and entrypoint health.",
    integration: "Traefik API URL required",
    icon: Network
  }
};

const widgetDetails: Record<WidgetId, {
  label: string;
  description: string;
  integration: string;
  icon: typeof Network;
}> = {
  ...coreWidgetDetails,
  ...additionalWidgetDetails
};

interface WidgetMeta {
  label: string;
  description: string;
}

const widgetGroups: Array<{
  label: string;
  widgets: WidgetId[];
}> = [
  { label: "Core", widgets: ["unifi", "docker", "gluetun", "ollama", "assistant"] },
  { label: "Media", widgets: ["plex", "jellyfin", "tautulli"] },
  { label: "Downloads", widgets: ["qbittorrent", "sonarr", "radarr", "lidarr", "readarr"] },
  { label: "Network", widgets: ["pihole", "adguard", "nginxproxymanager", "traefik"] },
  { label: "Infrastructure", widgets: ["homeassistant", "proxmox", "truenas", "portainer", "uptimekuma", "backup"] },
  { label: "Personal", widgets: ["today", "tasks", "mail", "notes", "journal"] },
  { label: "RSS", widgets: ["rss"] }
];

const allWidgets: WidgetId[] = [
  "today",
  "tasks",
  "mail",
  "unifi",
  "plex",
  "docker",
  "gluetun",
  "qbittorrent",
  "ollama",
  "assistant",
  "rss",
  "backup",
  "notes",
  "journal",
  ...(Object.keys(additionalWidgetDetails) as AdditionalIntegrationId[])
];

function buildEnabledState(widgets: WidgetFlags): Record<WidgetId, boolean> {
  return allWidgets.reduce<Record<WidgetId, boolean>>((state, widget) => {
    state[widget] = Boolean(widgets[widget]);
    return state;
  }, {} as Record<WidgetId, boolean>);
}

function normalizeWidgetOrder(source: WidgetId[]): WidgetId[] {
  const orderedWidgets = source.filter((widget) => allWidgets.includes(widget));
  const missingWidgets = allWidgets.filter((widget) => !orderedWidgets.includes(widget));
  return [...orderedWidgets, ...missingWidgets];
}

export default function WidgetOrderModal({
  open,
  widgets,
  widgetOrder,
  mobileWidgetOrder,
  widgetLayout,
  widgetStyle,
  saving,
  onClose,
  onConfigure,
  onRefresh,
  onSave
}: WidgetOrderModalProps) {
  const [order, setOrder] = useState<WidgetId[]>(normalizeWidgetOrder(widgetOrder));
  const [mobileOrder, setMobileOrder] = useState<WidgetId[]>(normalizeWidgetOrder(mobileWidgetOrder.length ? mobileWidgetOrder : widgetOrder));
  const [enabled, setEnabled] = useState<Record<WidgetId, boolean>>(buildEnabledState(widgets));
  const [rssTicker, setRssTicker] = useState(Boolean(widgets.rssTicker));
  const [layout, setLayout] = useState<WidgetLayout>(widgetLayout ?? "sidebar");
  const [style, setStyle] = useState<WidgetStyle>(widgetStyle ?? "cards");
  const [query, setQuery] = useState("");
  const [orderTarget, setOrderTarget] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    if (open) {
      setOrder(normalizeWidgetOrder(widgetOrder));
      setMobileOrder(normalizeWidgetOrder(mobileWidgetOrder.length ? mobileWidgetOrder : widgetOrder));
      setEnabled(buildEnabledState(widgets));
      setRssTicker(Boolean(widgets.rssTicker));
      setLayout(widgetLayout ?? "sidebar");
      setStyle(widgetStyle ?? "cards");
      setQuery("");
      setOrderTarget("desktop");
    }
  }, [mobileWidgetOrder, open, widgetLayout, widgetOrder, widgetStyle, widgets]);

  const currentOrder = orderTarget === "desktop" ? order : mobileOrder;
  const activeOrder = currentOrder.filter((widget) => enabled[widget]);
  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return widgetGroups
      .map((group) => ({
        ...group,
        widgets: group.widgets.filter((widget) => {
          const details = widgetDetails[widget];

          if (!needle) {
            return true;
          }

          return [details.label, details.description, details.integration, group.label]
            .some((value) => value.toLowerCase().includes(needle));
        })
      }))
      .filter((group) => group.widgets.length > 0);
  }, [query]);

  function moveWidget(widget: WidgetId, direction: -1 | 1) {
    const activeIndex = activeOrder.indexOf(widget);
    const targetWidget = activeOrder[activeIndex + direction];

    if (!targetWidget) {
      return;
    }

    const index = currentOrder.indexOf(widget);
    const nextIndex = currentOrder.indexOf(targetWidget);

    if (nextIndex < 0 || nextIndex >= currentOrder.length) {
      return;
    }

    const setter = orderTarget === "desktop" ? setOrder : setMobileOrder;

    setter((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function toggleWidget(widget: WidgetId, checked: boolean) {
    setEnabled((current) => ({ ...current, [widget]: checked }));
  }

  function widgetOrderMeta(_widget: WidgetId): WidgetMeta | null {
    return null;
  }

  function widgetLibraryMeta(_widget: WidgetId): WidgetMeta | null {
    return null;
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 backdrop-blur sm:items-center sm:justify-center">
      <section className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-white/10 bg-deck-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-100/80">Widgets</p>
            <h2 className="text-xl font-semibold text-white">Widget manager</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Choose what appears on the dashboard, reorder cards and jump to integration settings when a widget needs credentials.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close widget order"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-5 rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Dashboard layout</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {[
                    ["sidebar", "Sidebar", "Current right-column layout"],
                    ["center", "Center", "Widgets sit in the main content"],
                    ["rail", "App rail", "Apps in the left rail, widgets in the center"]
                  ].map(([value, label, description]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLayout(value as WidgetLayout)}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        layout === value
                          ? "border-amber-200/35 bg-amber-200/10 text-amber-50"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Widget style</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {[
                    ["cards", "Cards", "Current full widget cards"],
                    ["dense", "Dense cards", "Glanceable data with less height"],
                    ["compact", "Compact blend", "Small tiles with hover details"]
                  ].map(([value, label, description]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStyle(value as WidgetStyle)}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        style === value
                          ? "border-cyan-200/35 bg-cyan-200/10 text-cyan-50"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={rssTicker}
                onChange={(event) => setRssTicker(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-amber-300 accent-amber-300"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Rss className="h-4 w-4 text-amber-100" />
                  RSS top bar ticker
                </span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">
                  Show feed headlines in a slim news-style bar at the top. You can turn off the RSS Radar card separately below.
                </span>
              </span>
            </label>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.2fr)]">
            <section className="rounded-xl border border-white/10 bg-black/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Widget order</p>
                <p className="mt-1 text-xs text-slate-600">
                  Desktop and mobile can use different orders without changing which widgets are enabled.
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-500">{activeOrder.length}</span>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-1">
              {[
                ["desktop", "Desktop"],
                ["mobile", "Mobile"]
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOrderTarget(value as "desktop" | "mobile")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    orderTarget === value
                      ? "bg-amber-200/15 text-amber-50 shadow-inner"
                      : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

              <div className="space-y-2">
                {activeOrder.map((widget, index) => {
                  const details = widgetDetails[widget];
                  const Icon = details.icon;
                  const meta = widgetOrderMeta(widget);

                  return (
                    <div key={widget} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-amber-200/15 bg-amber-200/[0.045] p-3">
                      <span className="w-6 text-center text-xs font-semibold tabular-nums text-slate-500">{index + 1}</span>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200/20 bg-amber-200/10 text-amber-100">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-semibold text-slate-100">{details.label}</span>
                            {meta ? (
                              <span className="shrink-0 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100">
                                {meta.label}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{meta?.description ?? details.integration}</span>
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveWidget(widget, -1)}
                          disabled={index === 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                          aria-label={`Move ${details.label} up`}
                          title={`Move ${details.label} up`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveWidget(widget, 1)}
                          disabled={index === activeOrder.length - 1}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                          aria-label={`Move ${details.label} down`}
                          title={`Move ${details.label} down`}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!activeOrder.length ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-500">
                    Enable widgets from the library to build your dashboard order.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-black/10 p-4">
              <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Widget library</p>
                  <p className="mt-1 text-xs text-slate-600">Search, enable and disable widgets by group.</p>
                </div>
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="input h-10 pl-9 md:w-72"
                    placeholder="Search widgets"
                  />
                </label>
              </div>

              <div className="space-y-4">
                {filteredGroups.map((group) => (
                  <div key={group.label}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{group.label}</h3>
                      <span className="text-xs text-slate-600">
                        {group.widgets.filter((widget) => enabled[widget]).length}/{group.widgets.length}
                      </span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {group.widgets.map((widget) => {
                        const details = widgetDetails[widget];
                        const Icon = details.icon;
                        const meta = widgetLibraryMeta(widget);

                        return (
                          <label
                            key={widget}
                            className={`flex min-w-0 cursor-pointer gap-3 rounded-lg border p-3 transition ${
                              enabled[widget]
                                ? "border-amber-200/25 bg-white/[0.055]"
                                : "border-white/10 bg-white/[0.025] hover:bg-white/[0.045]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={enabled[widget]}
                              onChange={(event) => toggleWidget(widget, event.target.checked)}
                              className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-950 text-amber-300 accent-amber-300"
                            />
                            <span className="flex min-w-0 gap-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                                enabled[widget] ? "border-amber-200/25 bg-amber-200/10 text-amber-100" : "border-white/10 bg-white/[0.03] text-slate-500"
                              }`}>
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className={enabled[widget] ? "flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-100" : "flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-500"}>
                                  <span className="truncate">{details.label}</span>
                                </span>
                                <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">{meta?.description ?? details.description}</span>
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {!filteredGroups.length ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-500">
                    No widgets match your search.
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onConfigure}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <Settings2 className="h-4 w-4" />
              Configure integrations
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh widgets
            </button>
          </div>
          <button
            type="button"
            onClick={() => void onSave(order, mobileOrder, { ...enabled, rssTicker }, layout, style)}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save widgets"}
          </button>
        </div>
      </section>
    </div>
  );
}
