import { ArrowDown, ArrowUp, DownloadCloud, Edit3, ExternalLink, Grid3X3, Layers3, Plus, Radar, RefreshCw, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { DashboardLink, LinkLayout } from "../types";

interface ServiceManagerModalProps {
  links: DashboardLink[];
  open: boolean;
  busyAction: string | null;
  linkLayout: LinkLayout;
  onClose: () => void;
  onCreate: () => void;
  onEdit: (link: DashboardLink) => void;
  onDelete: (link: DashboardLink) => void;
  onDockerImport: () => void;
  onHeimdallImport: () => void;
  onRefreshLibrary: () => void;
  onReorder: (ids: string[]) => Promise<void>;
  onLinkLayoutChange: (layout: LinkLayout) => Promise<void>;
}

export default function ServiceManagerModal({
  links,
  open,
  busyAction,
  linkLayout,
  onClose,
  onCreate,
  onEdit,
  onDelete,
  onDockerImport,
  onHeimdallImport,
  onRefreshLibrary,
  onReorder,
  onLinkLayoutChange
}: ServiceManagerModalProps) {
  const [query, setQuery] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);

  const filteredLinks = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return links;
    }

    return links.filter((link) =>
      [link.name, link.url, link.description, link.category].some((value) => value.toLowerCase().includes(needle))
    );
  }, [links, query]);

  if (!open) {
    return null;
  }

  async function moveLink(link: DashboardLink, direction: -1 | 1) {
    const index = links.findIndex((item) => item.id === link.id);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= links.length) {
      return;
    }

    const nextLinks = [...links];
    const [item] = nextLinks.splice(index, 1);
    nextLinks.splice(nextIndex, 0, item);

    setSavingOrder(true);
    try {
      await onReorder(nextLinks.map((nextLink) => nextLink.id).filter((id): id is string => Boolean(id)));
    } finally {
      setSavingOrder(false);
    }
  }

  async function saveLayout(layout: LinkLayout) {
    setSavingLayout(true);
    try {
      await onLinkLayoutChange(layout);
    } finally {
      setSavingLayout(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/70 p-4 backdrop-blur sm:items-center sm:justify-center">
      <section className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-white/10 bg-deck-900 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-200/80">Service management</p>
            <h2 className="text-xl font-semibold text-white">Links, imports and maintenance</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDockerImport}
              disabled={busyAction !== null}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Radar className="h-4 w-4" />
              Docker
            </button>
            <button
              type="button"
              onClick={onHeimdallImport}
              disabled={busyAction !== null}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <DownloadCloud className="h-4 w-4" />
              Heimdall
            </button>
            <button
              type="button"
              onClick={onRefreshLibrary}
              disabled={busyAction !== null}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${busyAction === "library" ? "animate-spin" : ""}`} />
              Library
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close service management"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-white/10 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input"
            placeholder="Filter services by name, URL, category or notes"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void saveLayout("grouped")}
              disabled={savingLayout || linkLayout === "grouped"}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed ${
                linkLayout === "grouped"
                  ? "border-cyan-200/30 bg-cyan-200/10 text-cyan-100"
                  : "border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-60"
              }`}
            >
              <Layers3 className="h-4 w-4" />
              Groups
            </button>
            <button
              type="button"
              onClick={() => void saveLayout("grid")}
              disabled={savingLayout || linkLayout === "grid"}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed ${
                linkLayout === "grid"
                  ? "border-cyan-200/30 bg-cyan-200/10 text-cyan-100"
                  : "border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-60"
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
              Grid
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-3 sm:p-5">
          <div className="overflow-hidden rounded-xl border border-white/10">
            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(8rem,0.45fr)_11rem] gap-4 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-500 sm:grid">
              <span>Service</span>
              <span>Category</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-white/10">
              {filteredLinks.map((link) => (
                <div
                  key={link.id}
                  className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.45fr)_11rem] sm:items-center sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">{link.name}</p>
                    <p className="mt-1 truncate text-slate-500">{link.url}</p>
                    {link.description ? <p className="mt-1 truncate text-xs text-slate-600">{link.description}</p> : null}
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 sm:text-sm sm:normal-case sm:tracking-normal">
                    {link.category}
                  </p>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => void moveLink(link, -1)}
                      disabled={Boolean(query.trim()) || savingOrder || links.findIndex((item) => item.id === link.id) === 0}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Move ${link.name} up`}
                      title={query.trim() ? "Clear filter to reorder" : `Move ${link.name} up`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveLink(link, 1)}
                      disabled={Boolean(query.trim()) || savingOrder || links.findIndex((item) => item.id === link.id) === links.length - 1}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Move ${link.name} down`}
                      title={query.trim() ? "Clear filter to reorder" : `Move ${link.name} down`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-cyan-200"
                      aria-label={`Open ${link.name}`}
                      title={`Open ${link.name}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onEdit(link)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-cyan-200"
                      aria-label={`Edit ${link.name}`}
                      title={`Edit ${link.name}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(link)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                      aria-label={`Delete ${link.name}`}
                      title={`Delete ${link.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {!filteredLinks.length ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">No services found.</div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
