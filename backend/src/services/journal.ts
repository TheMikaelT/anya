import { createPrivateId, nowIso, queryAllSql, runSql, withPrivateDatabase } from "./privateData.js";

export interface JournalEntry {
  id: string;
  entryDate: string;
  title: string;
  body: string;
  mood?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryInput {
  entryDate?: string;
  title?: string;
  body?: string;
  mood?: string;
}

interface JournalEntryRow {
  id: string;
  entry_date: string;
  title: string;
  body: string;
  mood: string | null;
  created_at: string;
  updated_at: string;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function mapJournalEntry(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    title: row.title,
    body: row.body,
    mood: row.mood ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function cleanDate(value?: string) {
  const date = value?.trim() || todayDate();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Journal date must use YYYY-MM-DD format");
  }

  return date;
}

function cleanMood(value?: string) {
  const mood = value?.trim();

  if (!mood) {
    return undefined;
  }

  return mood.slice(0, 40);
}

function cleanJournalInput(input: JournalEntryInput) {
  const entryDate = cleanDate(input.entryDate);
  const title = input.title?.trim() || entryDate;
  const body = input.body?.trim() ?? "";

  if (!body) {
    throw new Error("Journal body is required");
  }

  return {
    entryDate,
    title: title.slice(0, 160),
    body: body.slice(0, 40_000),
    mood: cleanMood(input.mood)
  };
}

export async function listJournalEntries(query?: string): Promise<{ entries: JournalEntry[] }> {
  const search = query?.trim().toLowerCase();

  return withPrivateDatabase((db) => {
    const rows = queryAllSql<JournalEntryRow>(
      db,
      `SELECT id, entry_date, title, body, mood, created_at, updated_at
       FROM journal_entries
       ORDER BY entry_date DESC, updated_at DESC`
    );

    const entries = rows.map(mapJournalEntry).filter((entry) => {
      if (!search) {
        return true;
      }

      return `${entry.entryDate} ${entry.title} ${entry.body} ${entry.mood ?? ""}`.toLowerCase().includes(search);
    });

    return { entries };
  }, false);
}

export async function createJournalEntry(input: JournalEntryInput): Promise<{ entry: JournalEntry }> {
  const entry = cleanJournalInput(input);
  const id = createPrivateId();
  const now = nowIso();

  return withPrivateDatabase((db) => {
    runSql(
      db,
      `INSERT INTO journal_entries (id, entry_date, title, body, mood, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, entry.entryDate, entry.title, entry.body, entry.mood ?? null, now, now]
    );

    return {
      entry: {
        id,
        ...entry,
        createdAt: now,
        updatedAt: now
      }
    };
  });
}

export async function updateJournalEntry(id: string, input: JournalEntryInput): Promise<{ entry: JournalEntry }> {
  const entry = cleanJournalInput(input);
  const now = nowIso();

  return withPrivateDatabase((db) => {
    const existing = queryAllSql<{ id: string }>(db, "SELECT id FROM journal_entries WHERE id = ?", [id]);

    if (!existing.length) {
      throw new Error("Journal entry not found");
    }

    runSql(
      db,
      `UPDATE journal_entries
       SET entry_date = ?, title = ?, body = ?, mood = ?, updated_at = ?
       WHERE id = ?`,
      [entry.entryDate, entry.title, entry.body, entry.mood ?? null, now, id]
    );

    const rows = queryAllSql<JournalEntryRow>(
      db,
      `SELECT id, entry_date, title, body, mood, created_at, updated_at
       FROM journal_entries
       WHERE id = ?`,
      [id]
    );

    return { entry: mapJournalEntry(rows[0]) };
  });
}

export async function deleteJournalEntry(id: string): Promise<{ ok: true }> {
  return withPrivateDatabase((db) => {
    const existing = queryAllSql<{ id: string }>(db, "SELECT id FROM journal_entries WHERE id = ?", [id]);

    if (!existing.length) {
      throw new Error("Journal entry not found");
    }

    runSql(db, "DELETE FROM journal_entries WHERE id = ?", [id]);

    return { ok: true };
  });
}
