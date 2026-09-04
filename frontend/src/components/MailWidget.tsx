import { ExternalLink, Mail, MailOpen, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { MailData } from "../types";
import WidgetCard from "./WidgetCard";

interface MailWidgetProps {
  refreshKey?: number;
}

function formatTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return new Intl.DateTimeFormat(undefined, sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { month: "short", day: "numeric" }).format(date);
}

function formatCheckedAt(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function MailWidget({ refreshKey = 0 }: MailWidgetProps) {
  const [data, setData] = useState<MailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load(refresh = false) {
    if (refresh) {
      setRefreshing(true);
    } else if (!data) {
      setLoading(true);
    }

    api
      .mail()
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(() => load(true), 2 * 60_000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const status = data?.status ?? (error ? "offline" : "unknown");
  const messages = useMemo(() => data?.messages ?? [], [data]);
  const alertEnabled = Boolean(data?.unreadAlertThreshold && data.unreadAlertThreshold > 0);
  const alertReached = Boolean(alertEnabled && data && data.unread >= (data.unreadAlertThreshold ?? 0));

  const action = (
    <div className="flex items-center gap-2">
      {data?.openUrl ? (
        <a
          href={data.openUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:border-amber-200/30 hover:text-amber-100"
          aria-label="Open mailbox"
          title="Open mailbox"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => load(true)}
        disabled={refreshing}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:border-amber-200/30 hover:text-amber-100 disabled:opacity-50"
        aria-label="Refresh mail"
        title="Refresh mail"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      </button>
    </div>
  );

  return (
    <WidgetCard title={data?.providerName ?? "Mail"} icon={<Mail className="h-5 w-5" />} status={status} action={action}>
      {!data?.configured ? (
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-5 text-amber-50">
          Configure IMAP mail in Manage &gt; Integrations.
        </div>
      ) : null}

      {error || data?.error ? (
        <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm leading-5 text-rose-100">
          {error ?? data?.error}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <div className={`rounded-lg border p-3 ${alertReached ? "border-amber-200/30 bg-amber-300/10" : "border-white/10 bg-white/[0.045]"}`}>
          <p className="text-2xl font-semibold text-slate-50">{data?.unread ?? "-"}</p>
          <p className="text-xs text-slate-500">Unread</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
          <p className="text-2xl font-semibold text-slate-50">{data?.total ?? "-"}</p>
          <p className="text-xs text-slate-500">Total</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
          <p className="truncate text-sm font-semibold text-slate-50">{data?.mailbox ?? "INBOX"}</p>
          <p className="text-xs text-slate-500">Mailbox</p>
        </div>
      </div>

      {alertEnabled ? (
        <p className={`mt-2 rounded-lg border px-3 py-2 text-xs ${alertReached ? "border-amber-200/25 bg-amber-300/10 text-amber-100" : "border-emerald-300/15 bg-emerald-400/[0.06] text-emerald-100"}`}>
          Alert at {data?.unreadAlertThreshold} unread {alertReached ? "is active." : "is quiet."}
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {loading && !data ? (
          <div className="rounded-lg border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-400">Checking mail...</div>
        ) : null}

        {!loading && data?.configured && !messages.length && !data.error ? (
          <div className="rounded-lg border border-emerald-300/15 bg-emerald-400/[0.07] p-3 text-sm text-emerald-100">Inbox is quiet.</div>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className="rounded-lg border border-white/10 bg-black/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                {message.unread ? <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-100" /> : <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />}
                <div className="min-w-0">
                  <p className={`truncate text-sm ${message.unread ? "font-semibold text-slate-50" : "font-medium text-slate-300"}`}>{message.subject}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{message.from}</p>
                </div>
              </div>
              <span className="shrink-0 text-xs text-slate-500">{formatTime(message.date)}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[0.68rem] uppercase tracking-[0.14em] text-slate-600">
        {data?.checkedAt ? `Checked ${formatCheckedAt(data.checkedAt)}` : "Read-only IMAP"}
      </p>
    </WidgetCard>
  );
}
