import { Bell, Check, CheckCircle2, Clock, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { ReminderItem, TaskItem } from "../types";
import WidgetCard from "./WidgetCard";

interface TasksWidgetProps {
  refreshKey: number;
}

const emptyTaskDraft = {
  title: "",
  notes: "",
  dueAt: ""
};

const emptyReminderDraft = {
  title: "",
  message: "",
  remindAt: ""
};

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function TasksWidget({ refreshKey }: TasksWidgetProps) {
  const [mode, setMode] = useState<"tasks" | "reminders">("tasks");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [query, setQuery] = useState("");
  const [taskDraft, setTaskDraft] = useState(emptyTaskDraft);
  const [reminderDraft, setReminderDraft] = useState(emptyReminderDraft);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    Promise.all([api.tasks(), api.reminders()])
      .then(([taskResponse, reminderResponse]) => {
        setTasks(taskResponse.tasks);
        setReminders(reminderResponse.reminders);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  const visibleTasks = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return tasks;
    }
    return tasks.filter((task) => `${task.title} ${task.notes} ${task.status}`.toLowerCase().includes(trimmed));
  }, [tasks, query]);

  const visibleReminders = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return reminders;
    }
    return reminders.filter((reminder) => `${reminder.title} ${reminder.message} ${reminder.status}`.toLowerCase().includes(trimmed));
  }, [reminders, query]);

  function startCreate(nextMode = mode) {
    setMode(nextMode);
    setEditingTaskId(null);
    setEditingReminderId(null);
    setTaskDraft(emptyTaskDraft);
    setReminderDraft(emptyReminderDraft);
    setExpanded(true);
    setError(null);
  }

  function startEditTask(task: TaskItem) {
    setMode("tasks");
    setEditingTaskId(task.id);
    setEditingReminderId(null);
    setTaskDraft({
      title: task.title,
      notes: task.notes,
      dueAt: toDateTimeLocal(task.dueAt)
    });
    setExpanded(true);
    setError(null);
  }

  function startEditReminder(reminder: ReminderItem) {
    setMode("reminders");
    setEditingReminderId(reminder.id);
    setEditingTaskId(null);
    setReminderDraft({
      title: reminder.title,
      message: reminder.message,
      remindAt: toDateTimeLocal(reminder.remindAt)
    });
    setExpanded(true);
    setError(null);
  }

  function closeDraft() {
    setExpanded(false);
    setEditingTaskId(null);
    setEditingReminderId(null);
    setTaskDraft(emptyTaskDraft);
    setReminderDraft(emptyReminderDraft);
    setError(null);
  }

  async function saveDraft() {
    setSaving(true);
    setError(null);

    try {
      if (mode === "tasks") {
        const input = {
          title: taskDraft.title,
          notes: taskDraft.notes,
          dueAt: taskDraft.dueAt || null,
          status: "open" as const
        };

        if (editingTaskId) {
          const current = tasks.find((task) => task.id === editingTaskId);
          await api.updateTask(editingTaskId, { ...input, status: current?.status ?? "open" });
        } else {
          await api.createTask(input);
        }
      } else {
        const input = {
          title: reminderDraft.title,
          message: reminderDraft.message,
          remindAt: reminderDraft.remindAt,
          status: "scheduled" as const
        };

        if (editingReminderId) {
          const current = reminders.find((reminder) => reminder.id === editingReminderId);
          await api.updateReminder(editingReminderId, { ...input, status: current?.status ?? "scheduled" });
        } else {
          await api.createReminder(input);
        }
      }

      closeDraft();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task: TaskItem) {
    try {
      await api.updateTask(task.id, {
        title: task.title,
        notes: task.notes,
        dueAt: task.dueAt,
        status: task.status === "done" ? "open" : "done"
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task update failed");
    }
  }

  async function toggleReminder(reminder: ReminderItem) {
    try {
      await api.updateReminder(reminder.id, {
        title: reminder.title,
        message: reminder.message,
        remindAt: reminder.remindAt,
        status: reminder.status === "done" ? "scheduled" : "done"
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reminder update failed");
    }
  }

  async function removeTask(task: TaskItem) {
    if (!window.confirm(`Delete task "${task.title}"?`)) {
      return;
    }

    try {
      await api.deleteTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task delete failed");
    }
  }

  async function removeReminder(reminder: ReminderItem) {
    if (!window.confirm(`Delete reminder "${reminder.title}"?`)) {
      return;
    }

    try {
      await api.deleteReminder(reminder.id);
      setReminders((current) => current.filter((item) => item.id !== reminder.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reminder delete failed");
    }
  }

  const openTasks = tasks.filter((task) => task.status === "open").length;
  const scheduledReminders = reminders.filter((reminder) => reminder.status === "scheduled").length;

  return (
    <WidgetCard
      title="Tasks"
      icon={<CheckCircle2 className="h-5 w-5" />}
      status="online"
      action={
        <button
          type="button"
          onClick={() => startCreate()}
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:border-amber-200/30 hover:text-amber-100"
          title={mode === "tasks" ? "New task" : "New reminder"}
        >
          <Plus className="h-4 w-4" />
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("tasks")}
          className={`rounded-lg border p-3 text-left transition ${mode === "tasks" ? "border-amber-200/30 bg-amber-300/10" : "border-white/10 bg-black/10 hover:border-white/20"}`}
        >
          <p className="text-xs text-slate-500">Open tasks</p>
          <p className="mt-1 font-semibold text-slate-100">{openTasks}</p>
        </button>
        <button
          type="button"
          onClick={() => setMode("reminders")}
          className={`rounded-lg border p-3 text-left transition ${mode === "reminders" ? "border-amber-200/30 bg-amber-300/10" : "border-white/10 bg-black/10 hover:border-white/20"}`}
        >
          <p className="text-xs text-slate-500">Reminders</p>
          <p className="mt-1 font-semibold text-slate-100">{scheduledReminders}</p>
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-slate-100 outline-none placeholder:text-slate-600"
            placeholder={mode === "tasks" ? "Search tasks" : "Search reminders"}
          />
        </label>
      </div>

      {expanded ? (
        <div className="mt-3 rounded-xl border border-amber-200/20 bg-amber-200/[0.04] p-3">
          {mode === "tasks" ? (
            <div className="grid gap-2">
              <input
                value={taskDraft.title}
                onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))}
                className="rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/40"
                placeholder="Task"
              />
              <input
                type="datetime-local"
                value={taskDraft.dueAt}
                onChange={(event) => setTaskDraft((current) => ({ ...current, dueAt: event.target.value }))}
                className="rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/40"
              />
              <textarea
                value={taskDraft.notes}
                onChange={(event) => setTaskDraft((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-20 resize-y rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/40"
                placeholder="Notes"
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <input
                value={reminderDraft.title}
                onChange={(event) => setReminderDraft((current) => ({ ...current, title: event.target.value }))}
                className="rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/40"
                placeholder="Reminder"
              />
              <input
                type="datetime-local"
                value={reminderDraft.remindAt}
                onChange={(event) => setReminderDraft((current) => ({ ...current, remindAt: event.target.value }))}
                className="rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/40"
              />
              <textarea
                value={reminderDraft.message}
                onChange={(event) => setReminderDraft((current) => ({ ...current, message: event.target.value }))}
                className="min-h-20 resize-y rounded-lg border border-white/10 bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200/40"
                placeholder="Message"
              />
            </div>
          )}

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
        {mode === "tasks"
          ? visibleTasks.slice(0, 7).map((task) => (
              <article key={task.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleTask(task)}
                    className={`mt-0.5 rounded-md border p-1 transition ${task.status === "done" ? "border-emerald-200/30 bg-emerald-400/10 text-emerald-100" : "border-white/10 text-slate-500 hover:text-emerald-100"}`}
                    title={task.status === "done" ? "Mark open" : "Mark done"}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className={`truncate text-sm font-semibold ${task.status === "done" ? "text-slate-500 line-through" : "text-slate-100"}`}>{task.title}</h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDateTime(task.dueAt)}
                    </div>
                    {task.notes ? <p className="mt-1 line-clamp-1 text-sm text-slate-500">{task.notes}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => startEditTask(task)} className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-100" title="Edit">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => removeTask(task)} className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-100" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))
          : visibleReminders.slice(0, 7).map((reminder) => (
              <article key={reminder.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleReminder(reminder)}
                    className={`mt-0.5 rounded-md border p-1 transition ${reminder.status === "done" ? "border-emerald-200/30 bg-emerald-400/10 text-emerald-100" : "border-white/10 text-slate-500 hover:text-emerald-100"}`}
                    title={reminder.status === "done" ? "Mark scheduled" : "Mark done"}
                  >
                    <Bell className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className={`truncate text-sm font-semibold ${reminder.status === "done" ? "text-slate-500 line-through" : "text-slate-100"}`}>{reminder.title}</h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDateTime(reminder.remindAt)}
                    </div>
                    {reminder.message ? <p className="mt-1 line-clamp-1 text-sm text-slate-500">{reminder.message}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => startEditReminder(reminder)} className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-100" title="Edit">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => removeReminder(reminder)} className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-100" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
      </div>
    </WidgetCard>
  );
}
