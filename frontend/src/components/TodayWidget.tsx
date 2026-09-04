import { Bell, CalendarCheck, CheckCircle2, DatabaseBackup, NotebookPen, Pin } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { TodayOverview } from "../types";
import WidgetCard from "./WidgetCard";

interface TodayWidgetProps {
  refreshKey: number;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function TodayWidget({ refreshKey }: TodayWidgetProps) {
  const [data, setData] = useState<TodayOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .today()
      .then((response) => {
        setData(response);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  const status = data?.backup.status === "warning" ? "offline" : data ? "online" : "unknown";
  const notesCount = (data?.notes.pinned.length ?? 0) + (data?.notes.recent.length ?? 0);
  const todayJournalCount = data?.journal.today.length ?? 0;
  const todayWorkCount = (data?.tasks.dueToday.length ?? 0) + (data?.reminders.dueToday.length ?? 0);

  return (
    <WidgetCard title="Today" icon={<CalendarCheck className="h-5 w-5" />} status={status}>
      <div className="grid grid-cols-4 gap-2 text-sm">
        <div className="rounded-lg border border-white/10 bg-black/10 p-3">
          <p className="text-xs text-slate-500">Date</p>
          <p className="mt-1 font-semibold text-slate-100">{data ? formatDate(data.date) : "-"}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/10 p-3">
          <p className="text-xs text-slate-500">Notes</p>
          <p className="mt-1 font-semibold text-slate-100">{notesCount}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/10 p-3">
          <p className="text-xs text-slate-500">Journal</p>
          <p className="mt-1 font-semibold text-slate-100">{todayJournalCount}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/10 p-3">
          <p className="text-xs text-slate-500">Due</p>
          <p className="mt-1 font-semibold text-slate-100">{todayWorkCount}</p>
        </div>
      </div>

      {data ? (
        <>
          <section className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <NotebookPen className="h-4 w-4" />
              Today's journal
            </div>
            {data.journal.today.length ? (
              <div className="space-y-2">
                {data.journal.today.slice(0, 2).map((entry) => (
                  <article key={entry.id}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="truncate text-sm font-semibold text-slate-100">{entry.title}</h3>
                      {entry.mood ? <span className="shrink-0 text-xs text-amber-100">{entry.mood}</span> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-slate-400">{entry.body}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No journal entry for today.</p>
            )}
          </section>

          <section className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <CheckCircle2 className="h-4 w-4" />
              Today tasks
            </div>
            {[...data.tasks.dueToday, ...data.tasks.open].slice(0, 4).length ? (
              <div className="space-y-2">
                {[...data.tasks.dueToday, ...data.tasks.open].slice(0, 4).map((task) => (
                  <article key={task.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-100">{task.title}</h3>
                      <p className="line-clamp-1 text-sm text-slate-500">{task.notes || (task.dueAt ? formatDateTime(task.dueAt) : "No notes")}</p>
                    </div>
                    {task.dueAt ? <span className="shrink-0 text-xs text-amber-100">{formatDateTime(task.dueAt)}</span> : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No open tasks.</p>
            )}
          </section>

          <section className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <Bell className="h-4 w-4" />
              Reminders
            </div>
            {[...data.reminders.dueToday, ...data.reminders.upcoming].slice(0, 3).length ? (
              <div className="space-y-2">
                {[...data.reminders.dueToday, ...data.reminders.upcoming].slice(0, 3).map((reminder) => (
                  <article key={reminder.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-100">{reminder.title}</h3>
                      <p className="line-clamp-1 text-sm text-slate-500">{reminder.message || "No message"}</p>
                    </div>
                    <span className="shrink-0 text-xs text-amber-100">{formatDateTime(reminder.remindAt)}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No scheduled reminders.</p>
            )}
          </section>

          <section className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <Pin className="h-4 w-4" />
              Useful notes
            </div>
            {[...data.notes.pinned, ...data.notes.recent].slice(0, 4).length ? (
              <div className="space-y-2">
                {[...data.notes.pinned, ...data.notes.recent].slice(0, 4).map((note) => (
                  <article key={note.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-100">{note.title}</h3>
                      <p className="line-clamp-1 text-sm text-slate-500">{note.body || "No body"}</p>
                    </div>
                    {note.pinned ? <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-100" /> : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No notes yet.</p>
            )}
          </section>

          <section className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <DatabaseBackup className="h-4 w-4" />
                  Backup
                </div>
                <p className="mt-1 text-sm text-slate-300">{data.backup.message}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-500">
                <div className={data.backup.targetType === "external" ? "text-emerald-100" : "text-amber-100"}>
                  {data.backup.targetType}
                </div>
                <div>{formatDateTime(data.backup.lastRunAt)}</div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
    </WidgetCard>
  );
}
