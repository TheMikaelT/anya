import { createPrivateId, nowIso, queryAllSql, runSql, withPrivateDatabase } from "./privateData.js";

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  title?: string;
  body?: string;
  tags?: string[];
  pinned?: boolean;
}

interface NoteRow {
  id: string;
  title: string;
  body: string;
  tags: string;
  pinned: number;
  created_at: string;
  updated_at: string;
}

function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((tag): tag is string => typeof tag === "string");
  } catch {
    return [];
  }
}

function mapNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tags: parseTags(row.tags),
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function cleanTags(tags?: string[]) {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12)
    )
  );
}

function cleanNoteInput(input: NoteInput) {
  const title = input.title?.trim();
  const body = input.body?.trim() ?? "";

  if (!title) {
    throw new Error("Note title is required");
  }

  return {
    title: title.slice(0, 160),
    body: body.slice(0, 20_000),
    tags: cleanTags(input.tags),
    pinned: input.pinned === true
  };
}

export async function listNotes(query?: string): Promise<{ notes: Note[] }> {
  const search = query?.trim().toLowerCase();

  return withPrivateDatabase((db) => {
    const rows = queryAllSql<NoteRow>(
      db,
      `SELECT id, title, body, tags, pinned, created_at, updated_at
       FROM notes
       ORDER BY pinned DESC, updated_at DESC`
    );

    const notes = rows.map(mapNote).filter((note) => {
      if (!search) {
        return true;
      }

      return `${note.title} ${note.body} ${note.tags.join(" ")}`.toLowerCase().includes(search);
    });

    return { notes };
  }, false);
}

export async function createNote(input: NoteInput): Promise<{ note: Note }> {
  const note = cleanNoteInput(input);
  const id = createPrivateId();
  const now = nowIso();

  return withPrivateDatabase((db) => {
    runSql(
      db,
      `INSERT INTO notes (id, title, body, tags, pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, note.title, note.body, JSON.stringify(note.tags), note.pinned ? 1 : 0, now, now]
    );

    return {
      note: {
        id,
        ...note,
        createdAt: now,
        updatedAt: now
      }
    };
  });
}

export async function updateNote(id: string, input: NoteInput): Promise<{ note: Note }> {
  const note = cleanNoteInput(input);
  const now = nowIso();

  return withPrivateDatabase((db) => {
    const existing = queryAllSql<{ id: string }>(db, "SELECT id FROM notes WHERE id = ?", [id]);

    if (!existing.length) {
      throw new Error("Note not found");
    }

    runSql(
      db,
      `UPDATE notes
       SET title = ?, body = ?, tags = ?, pinned = ?, updated_at = ?
       WHERE id = ?`,
      [note.title, note.body, JSON.stringify(note.tags), note.pinned ? 1 : 0, now, id]
    );

    const rows = queryAllSql<NoteRow>(
      db,
      `SELECT id, title, body, tags, pinned, created_at, updated_at
       FROM notes
       WHERE id = ?`,
      [id]
    );

    return { note: mapNote(rows[0]) };
  });
}

export async function deleteNote(id: string): Promise<{ ok: true }> {
  return withPrivateDatabase((db) => {
    const existing = queryAllSql<{ id: string }>(db, "SELECT id FROM notes WHERE id = ?", [id]);

    if (!existing.length) {
      throw new Error("Note not found");
    }

    runSql(db, "DELETE FROM notes WHERE id = ?", [id]);

    return { ok: true };
  });
}
