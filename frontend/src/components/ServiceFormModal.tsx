import { RefreshCw, Save, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { DashboardLink, DashboardLinkInput, IconCatalog, IconCatalogItem, ServiceTemplate } from "../types";

interface ServiceFormModalProps {
  categories: string[];
  templates: ServiceTemplate[];
  iconCatalog: IconCatalog;
  link: DashboardLink | null;
  open: boolean;
  saving: boolean;
  refreshingIcons: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (link: DashboardLinkInput) => Promise<void>;
  onRefreshIcons: () => Promise<void>;
}

const iconOptions = [
  "server",
  "layout-dashboard",
  "container",
  "network",
  "film",
  "download",
  "workflow",
  "book-open",
  "activity",
  "bot",
  "cloud",
  "database"
];

const emptyForm: DashboardLinkInput = {
  name: "",
  url: "",
  description: "",
  category: "",
  icon: "server"
};

export default function ServiceFormModal({
  categories,
  templates,
  iconCatalog,
  link,
  open,
  saving,
  refreshingIcons,
  error,
  onClose,
  onSubmit,
  onRefreshIcons
}: ServiceFormModalProps) {
  const [form, setForm] = useState<DashboardLinkInput>(emptyForm);
  const [iconQuery, setIconQuery] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(
      link
        ? {
            name: link.name,
            url: link.url,
            description: link.description,
            category: link.category,
            icon: link.icon || "server",
            iconUrl: link.iconUrl
          }
        : emptyForm
    );
    setIconQuery(link?.name ?? "");
  }, [link, open]);

  const iconMatches = useMemo(() => {
    const query = (iconQuery || form.name).trim().toLowerCase();
    const words = query.split(/\s+/).filter(Boolean);
    const pool = iconCatalog.items;

    if (!words.length) {
      return pool.slice(0, 8);
    }

    return pool
      .map((item) => {
        const haystack = `${item.name} ${item.slug} ${(item.aliases ?? []).join(" ")}`.toLowerCase();
        const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
      .slice(0, 10)
      .map(({ item }) => item);
  }, [form.name, iconCatalog.items, iconQuery]);

  if (!open) {
    return null;
  }

  function updateField(field: keyof DashboardLinkInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applyIcon(item: IconCatalogItem) {
    setForm((current) => ({ ...current, iconUrl: item.iconUrl }));
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);

    if (!template) {
      return;
    }

    setForm({
      name: template.name,
      url: "",
      description: template.description,
      category: template.category,
      icon: template.icon,
      iconUrl: template.iconUrl
    });
    setIconQuery(template.name);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 backdrop-blur sm:items-center sm:justify-center">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(form);
        }}
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-deck-900 p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-200/80">Service</p>
            <h2 className="text-xl font-semibold text-white">{link ? "Edit service" : "Add service"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!link ? (
          <label className="mb-4 block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Template</span>
            <select
              defaultValue=""
              onChange={(event) => applyTemplate(event.target.value)}
              className="input"
            >
              <option value="">Generic service</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(event) => {
                updateField("name", event.target.value);
                setIconQuery(event.target.value);
              }}
              className="input"
              placeholder="Portainer"
            />
          </Field>
          <Field label="URL">
            <input
              required
              type="url"
              value={form.url}
              onChange={(event) => updateField("url", event.target.value)}
              className="input"
              placeholder="http://localhost:9000"
            />
          </Field>
          <Field label="Category">
            <input
              required
              value={form.category}
              onChange={(event) => updateField("category", event.target.value)}
              className="input"
              list="service-categories"
              placeholder="Docker"
            />
            <datalist id="service-categories">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </Field>
          <Field label="Icon">
            <select
              value={form.icon}
              onChange={(event) => updateField("icon", event.target.value)}
              className="input"
            >
              {iconOptions.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Icon library</span>
              <button
                type="button"
                onClick={() => void onRefreshIcons()}
                disabled={refreshingIcons}
                className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshingIcons ? "animate-spin" : ""}`} />
                {refreshingIcons ? "Refreshing..." : "Refresh icon library"}
              </button>
            </div>
            <input
              value={iconQuery}
              onChange={(event) => setIconQuery(event.target.value)}
              className="input mb-3"
              placeholder="Search icon, for example Plex or UniFi"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {iconMatches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyIcon(item)}
                  title={`${item.name} (${item.source})`}
                  className={`flex min-h-16 flex-col items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs transition ${
                    form.iconUrl === item.iconUrl
                      ? "border-amber-300/70 bg-amber-300/10 text-amber-100"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <img src={item.iconUrl} alt="" className="h-7 w-7 object-contain" loading="lazy" referrerPolicy="no-referrer" />
                  <span className="line-clamp-1 max-w-full">{item.name}</span>
                </button>
              ))}
            </div>
            <input
              value={form.iconUrl ?? ""}
              onChange={(event) => updateField("iconUrl", event.target.value)}
              className="input mt-3"
              placeholder="Optional direct icon URL"
            />
            {iconCatalog.updatedAt ? (
              <p className="mt-2 text-xs text-slate-500">
                Library updated {new Date(iconCatalog.updatedAt).toLocaleString()}.
              </p>
            ) : null}
            {iconCatalog.error ? <p className="mt-2 text-xs text-amber-200">{iconCatalog.error}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                className="input min-h-24 resize-y"
                placeholder="What this service is for"
              />
            </Field>
          </div>
        </div>

        {error ? <p className="mt-4 rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</p> : null}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-white/10 px-4 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save service"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}
