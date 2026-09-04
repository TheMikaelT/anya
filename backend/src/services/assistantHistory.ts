import { createPrivateId, nowIso, queryAllSql, runSql, withPrivateDatabase } from "./privateData.js";

export interface AssistantTurn {
  id: string;
  sessionId: string;
  question: string;
  response: string;
  sources: string[];
  mode: string;
  createdAt: string;
}

interface AssistantTurnRow {
  id: string;
  session_id: string;
  question: string;
  response: string;
  sources: string;
  mode: string;
  created_at: string;
}

function redactSensitiveText(value: string) {
  return value
    .replace(/\b(password|salasana|token|api[-_\s]?key|secret)\s*[:=]\s*\S+/gi, "$1: [redacted]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g, "$1 [redacted]")
    .replace(/\b[A-Za-z0-9._%+-]+:[^@\s]+@/g, "[redacted]@")
    .slice(0, 4000);
}

function mapTurn(row: AssistantTurnRow): AssistantTurn {
  let sources: string[] = [];

  try {
    const parsed = JSON.parse(row.sources) as unknown;
    sources = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    sources = [];
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    question: row.question,
    response: row.response,
    sources,
    mode: row.mode,
    createdAt: row.created_at
  };
}

export async function recordAssistantTurn(input: {
  sessionId?: string;
  question: string;
  response: string;
  sources?: string[];
  mode: string;
}) {
  const id = createPrivateId();
  const sessionId = redactSensitiveText(input.sessionId?.trim() || "default").slice(0, 160);
  const question = redactSensitiveText(input.question);
  const response = redactSensitiveText(input.response);
  const sources = JSON.stringify(input.sources ?? []);
  const mode = redactSensitiveText(input.mode).slice(0, 80);
  const createdAt = nowIso();

  await withPrivateDatabase((db) => {
    runSql(
      db,
      `INSERT INTO assistant_turns (id, session_id, question, response, sources, mode, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, sessionId, question, response, sources, mode, createdAt]
    );

    const oldRows = queryAllSql<{ id: string }>(
      db,
      `SELECT id FROM assistant_turns
       ORDER BY created_at DESC
       LIMIT -1 OFFSET 200`
    );

    for (const row of oldRows) {
      runSql(db, "DELETE FROM assistant_turns WHERE id = ?", [row.id]);
    }
  });
}

export async function listAssistantTurns(limit = 30, sessionId?: string): Promise<{ turns: AssistantTurn[] }> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const trimmedSession = sessionId?.trim();

  return withPrivateDatabase((db) => {
    const rows = trimmedSession
      ? queryAllSql<AssistantTurnRow>(
          db,
          `SELECT id, session_id, question, response, sources, mode, created_at
           FROM assistant_turns
           WHERE session_id = ?
           ORDER BY created_at DESC
           LIMIT ?`,
          [trimmedSession, safeLimit]
        )
      : queryAllSql<AssistantTurnRow>(
          db,
          `SELECT id, session_id, question, response, sources, mode, created_at
           FROM assistant_turns
           ORDER BY created_at DESC
           LIMIT ?`,
          [safeLimit]
        );

    return { turns: rows.map(mapTurn) };
  }, false);
}
