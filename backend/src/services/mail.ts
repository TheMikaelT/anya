import { ImapFlow } from "imapflow";
import type { DashboardConfig } from "../types.js";
import { loadSecretSettings } from "./secrets.js";

export interface MailMessageSummary {
  id: string;
  from: string;
  subject: string;
  date: string | null;
  unread: boolean;
}

export interface MailWidgetData {
  status: "online" | "offline" | "unknown";
  configured: boolean;
  providerName: string;
  mailbox: string;
  unread: number;
  total: number;
  messages: MailMessageSummary[];
  checkedAt: string;
  unreadAlertThreshold?: number;
  openUrl?: string;
  error?: string;
}

function cleanHost(host?: string) {
  return host?.trim().replace(/^imaps?:\/\//i, "").replace(/\/+$/, "");
}

function cleanMailbox(mailbox?: string) {
  return mailbox?.trim() || "INBOX";
}

function cleanMaxItems(value?: number) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 8;
  }

  return Math.min(20, Math.max(1, Math.round(numeric)));
}

function cleanUnreadAlertThreshold(value?: number) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(999, Math.max(0, Math.round(numeric)));
}

function formatAddressList(value: unknown) {
  if (!Array.isArray(value) || !value.length) {
    return "Unknown sender";
  }

  const first = value[0] as { name?: string; address?: string };
  return first.name || first.address || "Unknown sender";
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace(/password|token|secret/gi, "credential").slice(0, 180);
  }

  return "Mail check failed";
}

export async function getMailWidgetData(config: DashboardConfig): Promise<MailWidgetData> {
  const settings = config.integrations?.mail;
  const secrets = await loadSecretSettings();
  const password = secrets.mail?.password;
  const host = cleanHost(settings?.host);
  const username = settings?.username?.trim();
  const mailbox = cleanMailbox(settings?.mailbox);
  const providerName = settings?.providerName?.trim() || "Mail";
  const checkedAt = new Date().toISOString();
  const unreadAlertThreshold = cleanUnreadAlertThreshold(settings?.unreadAlertThreshold);

  if (!host || !username || !password) {
    return {
      status: "unknown",
      configured: false,
      providerName,
      mailbox,
      unread: 0,
      total: 0,
      messages: [],
      checkedAt,
      unreadAlertThreshold,
      openUrl: settings?.openUrl,
      error: "IMAP host, username and password are required"
    };
  }

  const client = new ImapFlow({
    host,
    port: settings?.port ?? (settings?.secure === false ? 143 : 993),
    secure: settings?.secure !== false,
    auth: {
      user: username,
      pass: password
    },
    logger: false,
    socketTimeout: 12_000,
    greetingTimeout: 8_000,
    connectionTimeout: 8_000
  });

  try {
    await client.connect();
    const box = await client.mailboxOpen(mailbox, { readOnly: true });
    const total = box.exists ?? 0;
    const maxItems = cleanMaxItems(settings?.maxItems);
    const start = Math.max(1, total - maxItems + 1);
    const messages: MailMessageSummary[] = [];

    if (total > 0) {
      for await (const message of client.fetch(`${start}:*`, {
        envelope: true,
        flags: true,
        internalDate: true,
        uid: true
      })) {
        messages.push({
          id: String(message.uid),
          from: formatAddressList(message.envelope?.from),
          subject: message.envelope?.subject?.trim() || "(no subject)",
          date: normalizeDate(message.envelope?.date ?? message.internalDate),
          unread: !message.flags?.has("\\Seen")
        });
      }
    }

    const status = await client.status(mailbox, { unseen: true, messages: true });

    return {
      status: "online",
      configured: true,
      providerName,
      mailbox,
      unread: status.unseen ?? messages.filter((message) => message.unread).length,
      total: status.messages ?? total,
      messages: messages.sort((a, b) => (Date.parse(b.date ?? "") || 0) - (Date.parse(a.date ?? "") || 0)),
      checkedAt,
      unreadAlertThreshold,
      openUrl: settings?.openUrl
    };
  } catch (error) {
    return {
      status: "offline",
      configured: true,
      providerName,
      mailbox,
      unread: 0,
      total: 0,
      messages: [],
      checkedAt,
      unreadAlertThreshold,
      openUrl: settings?.openUrl,
      error: errorMessage(error)
    };
  } finally {
    await client.logout().catch(() => undefined);
  }
}
