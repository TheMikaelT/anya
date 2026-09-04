import { getBackupStatus } from "./backup.js";
import { listJournalEntries, type JournalEntry } from "./journal.js";
import { listNotes, type Note } from "./notes.js";
import { listReminders, listTasks, type ReminderItem, type TaskItem } from "./tasks.js";

export interface TodayOverview {
  date: string;
  notes: {
    pinned: Note[];
    recent: Note[];
  };
  journal: {
    today: JournalEntry[];
    recent: JournalEntry[];
  };
  tasks: {
    dueToday: TaskItem[];
    open: TaskItem[];
  };
  reminders: {
    dueToday: ReminderItem[];
    upcoming: ReminderItem[];
  };
  backup: {
    status: "healthy" | "warning" | "unknown";
    message: string;
    lastRunAt: string | null;
    targetType: "local" | "external";
    targetAvailable: boolean;
  };
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function dateKey(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString().slice(0, 10);
}

export async function getTodayOverview(): Promise<TodayOverview> {
  const date = todayDate();
  const [{ notes }, { entries }, { tasks }, { reminders }, backup] = await Promise.all([
    listNotes(),
    listJournalEntries(),
    listTasks(),
    listReminders(),
    getBackupStatus()
  ]);

  const todayEntries = entries.filter((entry) => entry.entryDate === date);
  const pinnedNotes = notes.filter((note) => note.pinned).slice(0, 4);
  const pinnedIds = new Set(pinnedNotes.map((note) => note.id));
  const recentNotes = notes.filter((note) => !pinnedIds.has(note.id)).slice(0, 4);
  const lastRun = backup.lastRun;
  const openTasks = tasks.filter((task) => task.status === "open");
  const dueTodayTasks = openTasks.filter((task) => dateKey(task.dueAt) === date);
  const scheduledReminders = reminders.filter((reminder) => reminder.status === "scheduled");
  const dueTodayReminders = scheduledReminders.filter((reminder) => dateKey(reminder.remindAt) === date);
  const backupStatus = !backup.targetAvailable
    ? "warning"
    : lastRun?.status === "success"
      ? "healthy"
      : "unknown";

  return {
    date,
    notes: {
      pinned: pinnedNotes,
      recent: recentNotes
    },
    journal: {
      today: todayEntries,
      recent: entries.filter((entry) => entry.entryDate !== date).slice(0, 3)
    },
    tasks: {
      dueToday: dueTodayTasks.slice(0, 6),
      open: openTasks.filter((task) => !dueTodayTasks.some((dueTask) => dueTask.id === task.id)).slice(0, 6)
    },
    reminders: {
      dueToday: dueTodayReminders.slice(0, 6),
      upcoming: scheduledReminders.filter((reminder) => !dueTodayReminders.some((dueReminder) => dueReminder.id === reminder.id)).slice(0, 6)
    },
    backup: {
      status: backupStatus,
      message: !backup.targetAvailable
        ? backup.targetMessage
        : lastRun?.status === "success"
          ? lastRun.message
          : "No successful backup yet",
      lastRunAt: lastRun?.finishedAt ?? lastRun?.startedAt ?? null,
      targetType: backup.targetType,
      targetAvailable: backup.targetAvailable
    }
  };
}
