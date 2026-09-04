import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import initSqlJs from "sql.js";
import { getConfigDirectory } from "./config.js";
import {
  createPrivateId,
  ensurePrivateDatabase,
  getPrivateDatabasePath,
  listBackupRuns,
  nowIso,
  recordBackupRun,
  type BackupRunRow
} from "./privateData.js";

export interface BackupStatusResponse {
  backupDirectory: string;
  targetType: "local" | "external";
  targetLabel: string;
  targetAvailable: boolean;
  targetMessage: string;
  lastRun: BackupRunRow | null;
  runs: BackupRunRow[];
  recommendedTarget?: string;
  lastVerification?: BackupVerificationResponse;
}

export interface BackupRunResponse extends BackupStatusResponse {
  run: BackupRunRow;
}

export interface BackupVerificationItem {
  name: string;
  status: "ok" | "missing" | "warning";
  message: string;
}

export interface BackupVerificationResponse {
  backupId: string;
  status: "ok" | "warning" | "failed";
  checkedAt: string;
  targetPath: string;
  items: BackupVerificationItem[];
  message: string;
}

const localBackupDirectoryName = "backups";

export function getBackupDirectory() {
  return process.env.BACKUP_PATH
    ? path.resolve(process.env.BACKUP_PATH)
    : path.join(getConfigDirectory(), localBackupDirectoryName);
}

function getBackupTargetInfo() {
  const configuredPath = process.env.BACKUP_PATH?.trim();
  const defaultPath = path.join(getConfigDirectory(), localBackupDirectoryName);
  const backupDirectory = getBackupDirectory();
  const isDefaultPath = configuredPath ? path.resolve(configuredPath) === path.resolve(defaultPath) : true;

  return {
    backupDirectory,
    targetType: configuredPath && !isDefaultPath ? "external" as const : "local" as const,
    targetLabel: configuredPath && !isDefaultPath ? "External backup target" : "Local Anya backup"
  };
}

async function pathExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function copyIfExists(source: string, target: string) {
  if (!(await pathExists(source))) {
    return { copied: false, bytes: 0 };
  }

  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  const fileStat = await stat(target);
  return { copied: true, bytes: fileStat.size };
}

async function checkBackupTarget() {
  const { backupDirectory, targetType } = getBackupTargetInfo();
  const probePath = path.join(backupDirectory, `.anya-backup-probe-${Date.now()}`);

  try {
    await mkdir(backupDirectory, { recursive: true });
    await writeFile(probePath, "ok", "utf-8");
    await rm(probePath, { force: true });

    return {
      targetAvailable: true,
      targetMessage: targetType === "external" ? "External backup target is writable." : "Local backup folder is writable."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup target is not writable";

    return {
      targetAvailable: false,
      targetMessage: message
    };
  }
}

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function getBackupStatus(): Promise<BackupStatusResponse> {
  await ensurePrivateDatabase();

  const runs = await listBackupRuns();
  const targetInfo = getBackupTargetInfo();
  const target = await checkBackupTarget();

  return {
    ...targetInfo,
    ...target,
    recommendedTarget: targetInfo.targetType === "external" ? undefined : "Set BACKUP_PATH to a Jupiter-mounted folder when ready.",
    lastRun: runs[0] ?? null,
    runs
  };
}

export async function runBackup(): Promise<BackupRunResponse> {
  await ensurePrivateDatabase();

  const id = createPrivateId();
  const startedAt = nowIso();
  const targetPath = path.join(getBackupDirectory(), `anya-backup-${timestampForPath()}`);

  await recordBackupRun({
    id,
    status: "running",
    targetPath,
    startedAt,
    message: "Backup started"
  });

  try {
    await mkdir(targetPath, { recursive: true });

    const configDirectory = getConfigDirectory();
    const files = [
      { source: path.join(configDirectory, "dashboard.json"), target: path.join(targetPath, "config", "dashboard.json") },
      { source: path.join(configDirectory, "secrets.json"), target: path.join(targetPath, "config", "secrets.json") },
      { source: path.join(configDirectory, "templates.json"), target: path.join(targetPath, "config", "templates.json") },
      { source: getPrivateDatabasePath(), target: path.join(targetPath, "data", "anya-private.sqlite") }
    ];

    let filesCount = 0;
    let bytesWritten = 0;

    for (const file of files) {
      const result = await copyIfExists(file.source, file.target);

      if (result.copied) {
        filesCount += 1;
        bytesWritten += result.bytes;
      }
    }

    const uploadsPath = path.join(configDirectory, "uploads");
    if (await pathExists(uploadsPath)) {
      const backgroundsPath = path.join(uploadsPath, "backgrounds");

      if (await pathExists(backgroundsPath)) {
        const filesInBackgrounds = await readdir(backgroundsPath, { withFileTypes: true });

        for (const entry of filesInBackgrounds) {
          if (!entry.isFile()) {
            continue;
          }

          const result = await copyIfExists(
            path.join(backgroundsPath, entry.name),
            path.join(targetPath, "config", "uploads", "backgrounds", entry.name)
          );

          if (result.copied) {
            filesCount += 1;
            bytesWritten += result.bytes;
          }
        }
      }
    }

    const finishedAt = nowIso();
    await recordBackupRun({
      id,
      status: "success",
      targetPath,
      filesCount,
      bytesWritten,
      message: `Backed up ${filesCount} files`,
      startedAt,
      finishedAt
    });

    const status = await getBackupStatus();
    const run = status.runs.find((item) => item.id === id) ?? status.lastRun;

    if (!run) {
      throw new Error("Backup completed but run metadata was not found");
    }

    return { ...status, run };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    const finishedAt = nowIso();

    await recordBackupRun({
      id,
      status: "failed",
      targetPath,
      message,
      startedAt,
      finishedAt
    });

    throw error;
  }
}

async function verifyRequiredFile(name: string, filePath: string, required: boolean): Promise<BackupVerificationItem> {
  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return { name, status: "missing", message: "Not a file" };
    }

    if (fileStat.size === 0) {
      return { name, status: required ? "missing" : "warning", message: "File is empty" };
    }

    return { name, status: "ok", message: `${fileStat.size} bytes` };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        name,
        status: required ? "missing" : "ok",
        message: required ? "Required file is missing" : "Optional file is not present"
      };
    }

    throw error;
  }
}

async function verifySqliteDatabase(filePath: string): Promise<BackupVerificationItem> {
  const base = await verifyRequiredFile("Private database", filePath, true);

  if (base.status !== "ok") {
    return base;
  }

  try {
    const SQL = await initSqlJs();
    const file = await readFile(filePath);
    const db = new SQL.Database(file);

    try {
      const result = db.exec("SELECT name FROM sqlite_master WHERE type = 'table'");
      const tables = result[0]?.values.length ?? 0;
      return { name: "Private database", status: "ok", message: `${tables} tables readable` };
    } finally {
      db.close();
    }
  } catch (error) {
    return {
      name: "Private database",
      status: "missing",
      message: error instanceof Error ? error.message : "SQLite read failed"
    };
  }
}

export async function verifyBackup(id?: string): Promise<BackupVerificationResponse> {
  await ensurePrivateDatabase();

  const runs = await listBackupRuns(25);
  const run = id ? runs.find((item) => item.id === id) : runs[0];

  if (!run) {
    throw new Error("No backup run found");
  }

  const items = [
    await verifyRequiredFile("Dashboard config", path.join(run.targetPath, "config", "dashboard.json"), true),
    await verifyRequiredFile("Secrets config", path.join(run.targetPath, "config", "secrets.json"), false),
    await verifyRequiredFile("Templates config", path.join(run.targetPath, "config", "templates.json"), true),
    await verifySqliteDatabase(path.join(run.targetPath, "data", "anya-private.sqlite"))
  ];

  const hasMissing = items.some((item) => item.status === "missing");
  const hasWarning = items.some((item) => item.status === "warning");
  const status = hasMissing ? "failed" : hasWarning ? "warning" : "ok";

  return {
    backupId: run.id,
    status,
    checkedAt: nowIso(),
    targetPath: run.targetPath,
    items,
    message: status === "ok" ? "Backup looks restorable." : status === "warning" ? "Backup has optional warnings." : "Backup is missing required files."
  };
}
