import { Save, Search, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import type { SearchSettings } from "../types";

interface SearchSettingsModalProps {
  open: boolean;
  search: SearchSettings;
  defaultSearxngUrl?: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (settings: SearchSettings) => Promise<void>;
}

const googleSettings: SearchSettings = {
  label: "Google",
  urlTemplate: "https://www.google.com/search?q={query}",
  visible: true
};
const googleUrlTemplate = "https://www.google.com/search?q={query}";

export default function SearchSettingsModal({
  open,
  search,
  defaultSearxngUrl,
  saving,
  error,
  onClose,
  onSave
}: SearchSettingsModalProps) {
  const [form, setForm] = useState<SearchSettings>(googleSettings);
  const [searxngAddress, setSearxngAddress] = useState("");

  useEffect(() => {
    if (open) {
      const nextTemplate = search.urlTemplate || googleUrlTemplate;
      setForm({
        label: search.label || googleSettings.label,
        urlTemplate: nextTemplate,
        visible: search.visible !== false
      });
      setSearxngAddress(searxngAddressFromTemplate(nextTemplate) || defaultSearxngUrl || "");
    }
  }, [defaultSearxngUrl, open, search]);

  if (!open) {
    return null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(form);
  }

  function setGoogle() {
    setForm((current) => ({ ...googleSettings, visible: current.visible !== false }));
  }

  function setSearxng() {
    const address = searxngAddress || defaultSearxngUrl || "";

    if (!address) {
      setForm({
        label: "SearXNG",
        urlTemplate: "",
        visible: form.visible !== false
      });
      return;
    }

    const urlTemplate = searxngTemplateFromAddress(address);
    setForm({
      label: "SearXNG",
      urlTemplate,
      visible: form.visible !== false
    });
    setSearxngAddress(searxngAddressFromTemplate(urlTemplate) || address);
  }

  function updateSearxngAddress(value: string) {
    setSearxngAddress(value);

    if (!value.trim()) {
      setForm((current) => ({ ...current, label: "SearXNG", urlTemplate: "" }));
      return;
    }

    setForm((current) => ({
      ...current,
      label: "SearXNG",
      urlTemplate: searxngTemplateFromAddress(value)
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 backdrop-blur sm:items-center sm:justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-xl rounded-2xl border border-white/10 bg-deck-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-100/80">Search</p>
            <h2 className="text-xl font-semibold text-white">Web search provider</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close search settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error ? <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div> : null}

          <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span>
              <span className="block text-sm font-semibold text-slate-100">Show search bar</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Hide the top search area when Anya should stay as a clean service launcher.
              </span>
            </span>
            <input
              type="checkbox"
              checked={form.visible !== false}
              onChange={(event) => setForm((current) => ({ ...current, visible: event.target.checked }))}
              className="h-5 w-5 rounded border-white/20 bg-slate-950 text-amber-300 focus:ring-amber-300"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={setGoogle}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <Search className="h-4 w-4" />
              Google
            </button>
            <button
              type="button"
              onClick={setSearxng}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <Search className="h-4 w-4" />
              SearXNG
            </button>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">SearXNG address</span>
            <input
              value={searxngAddress}
              onChange={(event) => updateSearxngAddress(event.target.value)}
              className="input"
              placeholder="https://searxng.example.local"
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Enter the base address where SearXNG runs. Anya will add <code>/search?q={"{query}"}</code>.
            </p>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Name</span>
            <input
              value={form.label ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              className="input"
              placeholder="Google"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">URL template</span>
            <input
              value={form.urlTemplate ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, urlTemplate: event.target.value }))}
              className="input"
              placeholder="https://www.google.com/search?q={query}"
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Use <code>{"{query}"}</code> where the search text should go.
            </p>
          </label>
        </div>

        <div className="flex justify-end border-t border-white/10 p-5">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save search"}
          </button>
        </div>
      </form>
    </div>
  );
}

function searxngTemplateFromAddress(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  return `${trimmed}/search?q={query}`;
}

function searxngAddressFromTemplate(value: string) {
  const match = value.match(/^(.*)\/search\?q=\{query\}$/);
  return match?.[1] ?? "";
}
