import { nowIso, queryAllSql, runSql, withPrivateDatabase } from "./privateData.js";

export type AssistantSubjectKind = "plex-item" | "web-query" | "news-query" | "service";

export interface AssistantSessionMemory {
  lastSubject?: string;
  lastSearchSubject?: string;
  lastSubjectKind?: AssistantSubjectKind;
  lastTool?: string;
  updatedAt: number;
}

interface AssistantSessionRow {
  id: string;
  last_subject: string | null;
  last_search_subject: string | null;
  last_subject_kind: string | null;
  last_tool: string | null;
  updated_at: string;
}

function sanitizeText(value: string | undefined, maxLength = 400) {
  return value
    ?.replace(/\b(password|salasana|token|api[-_\s]?key|secret)\s*[:=]\s*\S+/gi, "$1: [redacted]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g, "$1 [redacted]")
    .replace(/\b[A-Za-z0-9._%+-]+:[^@\s]+@/g, "[redacted]@")
    .trim()
    .slice(0, maxLength);
}

function safeSessionId(sessionId?: string) {
  return sanitizeText(sessionId?.trim() || "default", 160) || "default";
}

function isSubjectKind(value: string | null): value is AssistantSubjectKind {
  return value === "plex-item" || value === "web-query" || value === "news-query" || value === "service";
}

function mapRow(row: AssistantSessionRow): AssistantSessionMemory {
  return {
    lastSubject: row.last_subject ?? undefined,
    lastSearchSubject: row.last_search_subject ?? undefined,
    lastSubjectKind: isSubjectKind(row.last_subject_kind) ? row.last_subject_kind : undefined,
    lastTool: row.last_tool ?? undefined,
    updatedAt: Date.parse(row.updated_at) || Date.now()
  };
}

export async function loadAssistantSessionMemory(sessionId?: string): Promise<AssistantSessionMemory | undefined> {
  const id = safeSessionId(sessionId);

  return withPrivateDatabase((db) => {
    const rows = queryAllSql<AssistantSessionRow>(
      db,
      `SELECT id, last_subject, last_search_subject, last_subject_kind, last_tool, updated_at
       FROM assistant_sessions
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return rows[0] ? mapRow(rows[0]) : undefined;
  }, false);
}

export async function saveAssistantSessionMemory(sessionId: string | undefined, memory: Partial<AssistantSessionMemory>) {
  const id = safeSessionId(sessionId);
  const updatedAt = nowIso();
  const title = sanitizeText(memory.lastSubject, 80) || "Anya conversation";

  await withPrivateDatabase((db) => {
    runSql(
      db,
      `INSERT INTO assistant_sessions (
        id, title, created_at, updated_at, last_subject, last_search_subject, last_subject_kind, last_tool
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = COALESCE(excluded.title, assistant_sessions.title),
        updated_at = excluded.updated_at,
        last_subject = COALESCE(excluded.last_subject, assistant_sessions.last_subject),
        last_search_subject = COALESCE(excluded.last_search_subject, assistant_sessions.last_search_subject),
        last_subject_kind = COALESCE(excluded.last_subject_kind, assistant_sessions.last_subject_kind),
        last_tool = COALESCE(excluded.last_tool, assistant_sessions.last_tool)`,
      [
        id,
        title,
        updatedAt,
        updatedAt,
        sanitizeText(memory.lastSubject) ?? null,
        sanitizeText(memory.lastSearchSubject) ?? null,
        sanitizeText(memory.lastSubjectKind, 40) ?? null,
        sanitizeText(memory.lastTool, 80) ?? null
      ]
    );
  });
}
