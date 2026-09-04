import { createPrivateId, nowIso, queryAllSql, runSql, withPrivateDatabase } from "./privateData.js";

export type TaskStatus = "open" | "done";
export type ReminderStatus = "scheduled" | "done";

export interface TaskItem {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderItem {
  id: string;
  title: string;
  message: string;
  remindAt: string;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title?: string;
  notes?: string;
  status?: TaskStatus;
  dueAt?: string | null;
}

export interface ReminderInput {
  title?: string;
  message?: string;
  remindAt?: string;
  status?: ReminderStatus;
}

interface TaskRow {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReminderRow {
  id: string;
  title: string;
  message: string;
  remind_at: string;
  status: ReminderStatus;
  created_at: string;
  updated_at: string;
}

function mapTask(row: TaskRow): TaskItem {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapReminder(row: ReminderRow): ReminderItem {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    remindAt: row.remind_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function cleanOptionalDateTime(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Date must be a valid date or datetime");
  }

  return parsed.toISOString();
}

function cleanTaskInput(input: TaskInput) {
  const title = input.title?.trim();

  if (!title) {
    throw new Error("Task title is required");
  }

  const status = input.status === "done" ? "done" : "open";

  return {
    title: title.slice(0, 180),
    notes: (input.notes?.trim() ?? "").slice(0, 10_000),
    status: status as TaskStatus,
    dueAt: cleanOptionalDateTime(input.dueAt)
  };
}

function cleanReminderInput(input: ReminderInput) {
  const title = input.title?.trim();

  if (!title) {
    throw new Error("Reminder title is required");
  }

  const remindAt = cleanOptionalDateTime(input.remindAt);

  if (!remindAt) {
    throw new Error("Reminder time is required");
  }

  return {
    title: title.slice(0, 180),
    message: (input.message?.trim() ?? "").slice(0, 10_000),
    remindAt,
    status: (input.status === "done" ? "done" : "scheduled") as ReminderStatus
  };
}

export async function listTasks(query?: string): Promise<{ tasks: TaskItem[] }> {
  const search = query?.trim().toLowerCase();

  return withPrivateDatabase((db) => {
    const rows = queryAllSql<TaskRow>(
      db,
      `SELECT id, title, notes, status, due_at, created_at, updated_at
       FROM tasks
       ORDER BY status ASC, due_at IS NULL ASC, due_at ASC, updated_at DESC`
    );

    const tasks = rows.map(mapTask).filter((task) => {
      if (!search) {
        return true;
      }

      return `${task.title} ${task.notes} ${task.status}`.toLowerCase().includes(search);
    });

    return { tasks };
  }, false);
}

export async function createTask(input: TaskInput): Promise<{ task: TaskItem }> {
  const task = cleanTaskInput(input);
  const id = createPrivateId();
  const now = nowIso();

  return withPrivateDatabase((db) => {
    runSql(
      db,
      `INSERT INTO tasks (id, title, notes, status, due_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, task.title, task.notes, task.status, task.dueAt, now, now]
    );

    return {
      task: {
        id,
        ...task,
        createdAt: now,
        updatedAt: now
      }
    };
  });
}

export async function updateTask(id: string, input: TaskInput): Promise<{ task: TaskItem }> {
  const task = cleanTaskInput(input);
  const now = nowIso();

  return withPrivateDatabase((db) => {
    const existing = queryAllSql<{ id: string }>(db, "SELECT id FROM tasks WHERE id = ?", [id]);

    if (!existing.length) {
      throw new Error("Task not found");
    }

    runSql(
      db,
      `UPDATE tasks
       SET title = ?, notes = ?, status = ?, due_at = ?, updated_at = ?
       WHERE id = ?`,
      [task.title, task.notes, task.status, task.dueAt, now, id]
    );

    const rows = queryAllSql<TaskRow>(
      db,
      `SELECT id, title, notes, status, due_at, created_at, updated_at
       FROM tasks
       WHERE id = ?`,
      [id]
    );

    return { task: mapTask(rows[0]) };
  });
}

export async function deleteTask(id: string): Promise<{ ok: true }> {
  return withPrivateDatabase((db) => {
    const existing = queryAllSql<{ id: string }>(db, "SELECT id FROM tasks WHERE id = ?", [id]);

    if (!existing.length) {
      throw new Error("Task not found");
    }

    runSql(db, "DELETE FROM tasks WHERE id = ?", [id]);

    return { ok: true };
  });
}

export async function listReminders(query?: string): Promise<{ reminders: ReminderItem[] }> {
  const search = query?.trim().toLowerCase();

  return withPrivateDatabase((db) => {
    const rows = queryAllSql<ReminderRow>(
      db,
      `SELECT id, title, message, remind_at, status, created_at, updated_at
       FROM reminders
       ORDER BY status ASC, remind_at ASC`
    );

    const reminders = rows.map(mapReminder).filter((reminder) => {
      if (!search) {
        return true;
      }

      return `${reminder.title} ${reminder.message} ${reminder.status}`.toLowerCase().includes(search);
    });

    return { reminders };
  }, false);
}

export async function createReminder(input: ReminderInput): Promise<{ reminder: ReminderItem }> {
  const reminder = cleanReminderInput(input);
  const id = createPrivateId();
  const now = nowIso();

  return withPrivateDatabase((db) => {
    runSql(
      db,
      `INSERT INTO reminders (id, title, message, remind_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, reminder.title, reminder.message, reminder.remindAt, reminder.status, now, now]
    );

    return {
      reminder: {
        id,
        ...reminder,
        createdAt: now,
        updatedAt: now
      }
    };
  });
}

export async function updateReminder(id: string, input: ReminderInput): Promise<{ reminder: ReminderItem }> {
  const reminder = cleanReminderInput(input);
  const now = nowIso();

  return withPrivateDatabase((db) => {
    const existing = queryAllSql<{ id: string }>(db, "SELECT id FROM reminders WHERE id = ?", [id]);

    if (!existing.length) {
      throw new Error("Reminder not found");
    }

    runSql(
      db,
      `UPDATE reminders
       SET title = ?, message = ?, remind_at = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [reminder.title, reminder.message, reminder.remindAt, reminder.status, now, id]
    );

    const rows = queryAllSql<ReminderRow>(
      db,
      `SELECT id, title, message, remind_at, status, created_at, updated_at
       FROM reminders
       WHERE id = ?`,
      [id]
    );

    return { reminder: mapReminder(rows[0]) };
  });
}

export async function deleteReminder(id: string): Promise<{ ok: true }> {
  return withPrivateDatabase((db) => {
    const existing = queryAllSql<{ id: string }>(db, "SELECT id FROM reminders WHERE id = ?", [id]);

    if (!existing.length) {
      throw new Error("Reminder not found");
    }

    runSql(db, "DELETE FROM reminders WHERE id = ?", [id]);

    return { ok: true };
  });
}
