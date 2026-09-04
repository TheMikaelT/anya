import { BookText, CalendarDays, Check, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { JournalEntry } from "../types";
import WidgetCard from "./WidgetCard";

interface JournalWidgetProps {
  refreshKey: number;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

const emptyDraft = {
  entryDate: todayDate(),
  title: "",
  body: "",
  mood: ""
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

export default function JournalWidget({ refreshKey }: JournalWidgetProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .journal()
      .then((response) => {
        setEntries(response.entries);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  const visibleEntries = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return entries;
    }

    return entries.filter((entry) => `${entry.entryDate} ${entry.title} ${entry.body} ${entry.mood ?? ""}`.toLowerCase().includes(trimmed));
  }, [entries, query]);

  function startCreate() {
    setEditingId(null);
    setDraft({ ...emptyDraft, entryDate: todayDate() });
    setExpanded(true);
    setError(null);
  }

  function startEdit(entry: JournalEntry) {
    setEditingId(entry.id);
    setDraft({
      entryDate: entry.entryDate,
      title: entry.title,
      body: entry.body,
      mood: entry.mood ?? ""
    });
    setExpanded(true);
    setError(null);
  }

  function closeDraft() {
    setExpanded(false);
    setEditingId(null);
    setDraft({ ...emptyDraft, entryDate: todayDate() });
    setError(null);
  }

  async function saveDraft() {
    setSaving(true);
    setError(null);

    try {
      if (editingId) {
        await api.updateJournalEntry(editingId, draft);
      } else {
        await api.createJournalEntry(draft);
      }

      closeDraft();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Journal save failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(entry: JournalEntry) {
    if (!window.confirm(`Delete journal entry "${entry.title}"?`)) {
      return;
    }

    try {
      await api.deleteJournalEntry(entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Journal delete failed");
    }
  }

  return (
    <WidgetCard
      title="Journal"
      icon={<BookText className="h-5 w-5" />}
      status="online"
      action={
        <button
          type="button"
          onClick={startCreate}
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:border-amber-200/30 hover:text-amber-100"
          title="New journal entry"
        >
          <Plus className="h-4 w-4" />
        </button>
      }
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-slate-100 outline-none placeholder:text-slate-600"
              placeholder="Search journal"
            />
          </label>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm text-slate-300">
          {entries.length} entries
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 rounded-xl border border-amber-200/20 bg-amber-200/[0.04] p-3">
          <div className="grid gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-400 focus-within:border-amber-200/40">
              <CalendarDays className="h-4 w-4" />
              <input
                type="date"
                value={draft.entryDate}
                onChange={(event) => setDraft((current) => ({ ...current, entryDate: event.target.value }))}
                className="min-w-0 flex-1 bg-transparent text-slate-100 outline-none"
              />
            </label>
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              className="rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/40"
              placeholder="Title"
            />
            <input
              value={draft.mood}
              onChange={(event) => setDraft((current) => ({ ...current, mood: event.target.value }))}
              className="rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/40"
              placeholder="Mood, optional"
            />
            <textarea
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              className="min-h-32 resize-y rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/40"
              placeholder="What happened today?"
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDraft}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-white/20"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={saveDraft}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving ? "Saving" : "Save"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {visibleEntries.slice(0, 6).map((entry) => (
          <article key={entry.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                    {formatDate(entry.entryDate)}
                  </span>
                  {entry.mood ? (
                    <span className="rounded-full border border-amber-200/20 bg-amber-300/10 px-2 py-0.5 text-xs text-amber-100">
                      {entry.mood}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-2 truncate text-sm font-semibold text-slate-100">{entry.title}</h3>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-400">{entry.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => startEdit(entry)}
                  className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-100"
                  title="Edit"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeEntry(entry)}
                  className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-100"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!visibleEntries.length ? (
        <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/10 p-5 text-center text-sm text-slate-500">
          No journal entries yet.
        </div>
      ) : null}
    </WidgetCard>
  );
}
