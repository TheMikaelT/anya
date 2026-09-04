import { createHash } from "node:crypto";
import { nowIso, queryAllSql, runSql, withPrivateDatabase } from "./privateData.js";

export type NotificationSeverity = "warning" | "error" | "info";
export type NotificationStatus = "open" | "acknowledged" | "resolved";

export interface GeneratedNotification {
  severity: NotificationSeverity;
  title: string;
  message: string;
  source: string;
  createdAt: string;
}

export interface NotificationEvent extends GeneratedNotification {
  id: string;
  status: NotificationStatus;
  acknowledgedAt: string | null;
  lastSeenAt: string;
  resolvedAt: string | null;
  occurrences: number;
}

interface NotificationEventRow {
  id: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  source: string;
  status: NotificationStatus;
  created_at: string;
  acknowledged_at: string | null;
  last_seen_at: string | null;
  resolved_at: string | null;
  occurrences: number | null;
}

function notificationId(item: Pick<GeneratedNotification, "severity" | "source" | "title" | "message">) {
  return createHash("sha256")
    .update(`${item.severity}\n${item.source}\n${item.title}\n${item.message}`)
    .digest("hex")
    .slice(0, 24);
}

function mapEvent(row: NotificationEventRow): NotificationEvent {
  return {
    id: row.id,
    severity: row.severity,
    title: row.title,
    message: row.message,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    lastSeenAt: row.last_seen_at ?? row.created_at,
    resolvedAt: row.resolved_at,
    occurrences: row.occurrences ?? 1
  };
}

export async function syncNotificationEvents(generated: GeneratedNotification[]) {
  const seenAt = nowIso();
  const ids = new Set(generated.map(notificationId));

  return withPrivateDatabase((db) => {
    for (const item of generated) {
      const id = notificationId(item);
      const existing = queryAllSql<NotificationEventRow>(
        db,
        `SELECT id, severity, title, message, source, status, created_at, acknowledged_at, last_seen_at, resolved_at, occurrences
         FROM notification_events
         WHERE id = ?`,
        [id]
      )[0];

      if (existing) {
        runSql(
          db,
          `UPDATE notification_events
           SET severity = ?, title = ?, message = ?, source = ?, last_seen_at = ?, resolved_at = NULL,
               occurrences = COALESCE(occurrences, 0) + 1
           WHERE id = ?`,
          [item.severity, item.title, item.message, item.source, seenAt, id]
        );
        continue;
      }

      runSql(
        db,
        `INSERT INTO notification_events (
          id, severity, title, message, source, status, created_at, acknowledged_at, last_seen_at, resolved_at, occurrences
        ) VALUES (?, ?, ?, ?, ?, 'open', ?, NULL, ?, NULL, 1)`,
        [id, item.severity, item.title, item.message, item.source, item.createdAt, seenAt]
      );
    }

    const openRows = queryAllSql<{ id: string }>(
      db,
      "SELECT id FROM notification_events WHERE status = 'open'"
    );

    for (const row of openRows) {
      if (ids.has(row.id)) {
        continue;
      }

      runSql(
        db,
        "UPDATE notification_events SET status = 'resolved', resolved_at = ? WHERE id = ?",
        [seenAt, row.id]
      );
    }

    const rows = queryAllSql<NotificationEventRow>(
      db,
      `SELECT id, severity, title, message, source, status, created_at, acknowledged_at, last_seen_at, resolved_at, occurrences
       FROM notification_events
       WHERE status = 'open'
       ORDER BY severity = 'error' DESC, last_seen_at DESC`
    );

    return { items: rows.map(mapEvent) };
  });
}

export async function acknowledgeNotification(id: string) {
  const acknowledgedAt = nowIso();

  return withPrivateDatabase((db) => {
    const existing = queryAllSql<{ id: string }>(db, "SELECT id FROM notification_events WHERE id = ?", [id]);

    if (!existing.length) {
      throw new Error("Notification not found");
    }

    runSql(
      db,
      "UPDATE notification_events SET status = 'acknowledged', acknowledged_at = ? WHERE id = ?",
      [acknowledgedAt, id]
    );

    return { ok: true };
  });
}

export async function acknowledgeOpenNotifications() {
  const acknowledgedAt = nowIso();

  return withPrivateDatabase((db) => {
    runSql(
      db,
      "UPDATE notification_events SET status = 'acknowledged', acknowledged_at = ? WHERE status = 'open'",
      [acknowledgedAt]
    );

    return { ok: true };
  });
}

export async function listNotificationHistory(limit = 50) {
  return withPrivateDatabase((db) => {
    const rows = queryAllSql<NotificationEventRow>(
      db,
      `SELECT id, severity, title, message, source, status, created_at, acknowledged_at, last_seen_at, resolved_at, occurrences
       FROM notification_events
       ORDER BY last_seen_at DESC
       LIMIT ?`,
      [limit]
    );

    return { items: rows.map(mapEvent) };
  }, false);
}
