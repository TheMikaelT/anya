import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { getConfigDirectory } from "./config.js";

export interface PrivateDatabaseStatus {
  configured: true;
  path: string;
  migrationsApplied: number;
  tables: string[];
}

export type SqlValue = string | number | Uint8Array | null;

const databaseFileName = "anya-private.sqlite";
let sqlPromise: Promise<SqlJsStatic> | null = null;

const migrations = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    entry_date TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    mood TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    due_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    remind_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notification_events (
    id TEXT PRIMARY KEY,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    acknowledged_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS integration_sync_state (
    integration_id TEXT PRIMARY KEY,
    last_success_at TEXT,
    last_error_at TEXT,
    last_error TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS assistant_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS backup_runs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    target_path TEXT NOT NULL,
    files_count INTEGER NOT NULL DEFAULT 0,
    bytes_written INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL,
    finished_at TEXT
  )`,
  `ALTER TABLE notification_events ADD COLUMN last_seen_at TEXT`,
  `ALTER TABLE notification_events ADD COLUMN resolved_at TEXT`,
  `ALTER TABLE notification_events ADD COLUMN occurrences INTEGER NOT NULL DEFAULT 1`,
  `CREATE INDEX IF NOT EXISTS idx_notification_events_status_seen
    ON notification_events (status, last_seen_at)`,
  `CREATE TABLE IF NOT EXISTS assistant_turns (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    response TEXT NOT NULL,
    sources TEXT NOT NULL DEFAULT '[]',
    mode TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_assistant_turns_session_created
    ON assistant_turns (session_id, created_at DESC)`,
  `ALTER TABLE assistant_sessions ADD COLUMN last_subject TEXT`,
  `ALTER TABLE assistant_sessions ADD COLUMN last_search_subject TEXT`,
  `ALTER TABLE assistant_sessions ADD COLUMN last_subject_kind TEXT`,
  `ALTER TABLE assistant_sessions ADD COLUMN last_tool TEXT`
];

export function getPrivateDataDirectory() {
  return path.join(getConfigDirectory(), "data");
}

export function getPrivateDatabasePath() {
  return process.env.PRIVATE_DB_PATH
    ? path.resolve(process.env.PRIVATE_DB_PATH)
    : path.join(getPrivateDataDirectory(), databaseFileName);
}

export function createPrivateId() {
  return randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

async function getSql() {
  sqlPromise ??= initSqlJs();
  return sqlPromise;
}

async function openDatabase(): Promise<Database> {
  const SQL = await getSql();
  const dbPath = getPrivateDatabasePath();

  await mkdir(path.dirname(dbPath), { recursive: true });

  try {
    const file = await readFile(dbPath);
    return new SQL.Database(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    return new SQL.Database();
  }
}

async function saveDatabase(db: Database) {
  const dbPath = getPrivateDatabasePath();
  await mkdir(path.dirname(dbPath), { recursive: true });
  await writeFile(dbPath, Buffer.from(db.export()));
}

export function runSql(db: Database, sql: string, params: SqlValue[] = []) {
  const statement = db.prepare(sql);
  try {
    statement.run(params);
  } finally {
    statement.free();
  }
}

export function queryAllSql<T extends object>(db: Database, sql: string, params: SqlValue[] = []): T[] {
  const statement = db.prepare(sql);
  const rows: T[] = [];

  try {
    statement.bind(params);

    while (statement.step()) {
      rows.push(statement.getAsObject() as T);
    }
  } finally {
    statement.free();
  }

  return rows;
}

export async function withPrivateDatabase<T>(callback: (db: Database) => T | Promise<T>, persist = true): Promise<T> {
  const db = await openDatabase();

  try {
    applyMigrations(db);
    const result = await callback(db);

    if (persist) {
      await saveDatabase(db);
    }

    return result;
  } finally {
    db.close();
  }
}

function applyMigrations(db: Database) {
  db.run("BEGIN TRANSACTION");

  try {
    for (const [index, migration] of migrations.entries()) {
      const migrationId = index + 1;
      const name = `migration_${String(migrationId).padStart(3, "0")}`;

      if (migrationId === 1) {
        db.run(migration);
        runSql(
          db,
          "INSERT OR IGNORE INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)",
          [migrationId, name, nowIso()]
        );
        continue;
      }

      const existing = queryAllSql<{ id: number }>(db, "SELECT id FROM schema_migrations WHERE id = ?", [migrationId]);

      if (existing.length) {
        continue;
      }

      try {
        db.run(migration);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (!/^ALTER TABLE/i.test(migration.trim()) || !/duplicate column name/i.test(message)) {
          throw error;
        }
      }
      runSql(
        db,
        "INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)",
        [migrationId, name, nowIso()]
      );
    }

    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

export async function ensurePrivateDatabase() {
  return withPrivateDatabase(() => undefined);
}

export async function getPrivateDatabaseStatus(): Promise<PrivateDatabaseStatus> {
  return withPrivateDatabase((db) => {
    const migrationRows = queryAllSql<{ count: number }>(db, "SELECT COUNT(*) AS count FROM schema_migrations");
    const tableRows = queryAllSql<{ name: string }>(
      db,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    return {
      configured: true,
      path: getPrivateDatabasePath(),
      migrationsApplied: Number(migrationRows[0]?.count ?? 0),
      tables: tableRows.map((row) => row.name)
    };
  });
}

export async function recordBackupRun(input: {
  id: string;
  status: "running" | "success" | "failed";
  targetPath: string;
  filesCount?: number;
  bytesWritten?: number;
  message?: string;
  startedAt: string;
  finishedAt?: string;
}) {
  await withPrivateDatabase((db) => {
    runSql(
      db,
      `INSERT OR REPLACE INTO backup_runs (
        id, status, target_path, files_count, bytes_written, message, started_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.status,
        input.targetPath,
        input.filesCount ?? 0,
        input.bytesWritten ?? 0,
        input.message ?? "",
        input.startedAt,
        input.finishedAt ?? null
      ]
    );
  });
}

export interface BackupRunRow {
  id: string;
  status: "running" | "success" | "failed";
  targetPath: string;
  filesCount: number;
  bytesWritten: number;
  message: string;
  startedAt: string;
  finishedAt: string | null;
}

export async function listBackupRuns(limit = 8): Promise<BackupRunRow[]> {
  return withPrivateDatabase((db) => {
    const rows = queryAllSql<{
      id: string;
      status: "running" | "success" | "failed";
      target_path: string;
      files_count: number;
      bytes_written: number;
      message: string;
      started_at: string;
      finished_at: string | null;
    }>(
      db,
      `SELECT id, status, target_path, files_count, bytes_written, message, started_at, finished_at
       FROM backup_runs
       ORDER BY started_at DESC
       LIMIT ?`,
      [limit]
    );

    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      targetPath: row.target_path,
      filesCount: row.files_count,
      bytesWritten: row.bytes_written,
      message: row.message,
      startedAt: row.started_at,
      finishedAt: row.finished_at
    }));
  }, false);
}
