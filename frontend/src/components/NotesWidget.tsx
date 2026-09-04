import { BookOpen, Check, Edit3, Pin, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { Note } from "../types";
import WidgetCard from "./WidgetCard";

interface NotesWidgetProps {
  refreshKey: number;
}

const emptyDraft = {
  title: "",
  body: "",
  tags: "",
  pinned: false
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function NotesWidget({ refreshKey }: NotesWidgetProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .notes()
      .then((response) => {
        setNotes(response.notes);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  const visibleNotes = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return notes;
    }

    return notes.filter((note) => `${note.title} ${note.body} ${note.tags.join(" ")}`.toLowerCase().includes(trimmed));
  }, [notes, query]);

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft);
    setExpanded(true);
    setError(null);
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setDraft({
      title: note.title,
      body: note.body,
      tags: note.tags.join(", "),
      pinned: note.pinned
    });
    setExpanded(true);
    setError(null);
  }

  function closeDraft() {
    setExpanded(false);
    setEditingId(null);
    setDraft(emptyDraft);
    setError(null);
  }

  async function saveDraft() {
    setSaving(true);
    setError(null);

    try {
      const input = {
        title: draft.title,
        body: draft.body,
        tags: parseTags(draft.tags),
        pinned: draft.pinned
      };

      if (editingId) {
        await api.updateNote(editingId, input);
      } else {
        await api.createNote(input);
      }

      closeDraft();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Note save failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(note: Note) {
    if (!window.confirm(`Delete "${note.title}"?`)) {
      return;
    }

    try {
      await api.deleteNote(note.id);
      setNotes((current) => current.filter((item) => item.id !== note.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Note delete failed");
    }
  }

  async function togglePinned(note: Note) {
    try {
      await api.updateNote(note.id, {
        title: note.title,
        body: note.body,
        tags: note.tags,
        pinned: !note.pinned
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Note update failed");
    }
  }

  return (
    <WidgetCard
      title="Notes"
      icon={<BookOpen className="h-5 w-5" />}
      status="online"
      action={
        <button
          type="button"
          onClick={startCreate}
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:border-amber-200/30 hover:text-amber-100"
          title="New note"
        >
          <Plus className="h-4 w-4" />
        </button>
      }
    >
      <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-slate-100 outline-none placeholder:text-slate-600"
            placeholder="Search notes"
          />
        </label>
      </div>

      {expanded ? (
        <div className="mt-3 rounded-xl border border-amber-200/20 bg-amber-200/[0.04] p-3">
          <div className="grid gap-2">
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              className="rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/40"
              placeholder="Title"
            />
            <textarea
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              className="min-h-24 resize-y rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/40"
              placeholder="Write a note..."
            />
            <input
              value={draft.tags}
              onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
              className="rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/40"
              placeholder="Tags, comma separated"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setDraft((current) => ({ ...current, pinned: !current.pinned }))}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                draft.pinned
                  ? "border-amber-200/30 bg-amber-300/15 text-amber-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
              }`}
            >
              <Pin className="h-4 w-4" />
              Pin
            </button>
            <div className="flex items-center gap-2">
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
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {visibleNotes.slice(0, 8).map((note) => (
          <article key={note.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  {note.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-amber-100" /> : null}
                  <h3 className="truncate text-sm font-semibold text-slate-100">{note.title}</h3>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-slate-400">{note.body || "No body"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => togglePinned(note)}
                  className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-amber-100"
                  title={note.pinned ? "Unpin" : "Pin"}
                >
                  <Pin className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(note)}
                  className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-100"
                  title="Edit"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeNote(note)}
                  className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-100"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{formatDate(note.updatedAt)}</span>
              {note.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-slate-400">
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      {!visibleNotes.length ? (
        <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/10 p-5 text-center text-sm text-slate-500">
          No notes yet.
        </div>
      ) : null}
    </WidgetCard>
  );
}
