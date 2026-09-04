import { Bell, CheckCircle2, RefreshCw, TriangleAlert, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { NotificationItem, NotificationSeverity } from "../types";

interface NotificationCenterWidgetProps {
  refreshKey: number;
}

const severityStyles: Record<NotificationSeverity, { icon: typeof TriangleAlert; dot: string; border: string; bg: string; text: string }> = {
  warning: {
    icon: TriangleAlert,
    dot: "bg-amber-300",
    border: "border-amber-200/18",
    bg: "bg-amber-300/[0.08]",
    text: "text-amber-100"
  },
  error: {
    icon: XCircle,
    dot: "bg-rose-400",
    border: "border-rose-300/20",
    bg: "bg-rose-400/[0.08]",
    text: "text-rose-100"
  },
  info: {
    icon: Bell,
    dot: "bg-sky-300",
    border: "border-sky-200/15",
    bg: "bg-sky-300/[0.07]",
    text: "text-sky-100"
  }
};

function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function NotificationCenterWidget({ refreshKey }: NotificationCenterWidgetProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const visibleItems = useMemo(() => items.filter((item) => item.status === "open"), [items]);
  const hasError = visibleItems.some((item) => item.severity === "error");

  function loadNotifications() {
    setLoading(true);
    api
      .notifications()
      .then((data) => {
        setItems(data.items);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function dismiss(item: NotificationItem) {
    try {
      await api.acknowledgeNotification(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Notification acknowledge failed");
    }
  }

  async function dismissAll() {
    try {
      await api.acknowledgeAllNotifications();
      setItems((current) => current.filter((entry) => entry.status !== "open"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Notification acknowledge failed");
    }
  }

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60_000);

    return () => window.clearInterval(interval);
  }, [refreshKey]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      className="notification-center fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.25rem)] right-[max(0.75rem,env(safe-area-inset-right,0px))] z-[70] sm:bottom-auto sm:right-6 sm:top-4"
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`relative rounded-xl border px-3 py-3 shadow-glow backdrop-blur transition ${
          visibleItems.length
            ? hasError
              ? "border-rose-300/25 bg-rose-500/15 text-rose-100"
              : "border-amber-200/25 bg-amber-300/[0.12] text-amber-100"
            : "border-white/10 bg-[#25313b]/80 text-slate-300 hover:border-emerald-200/25 hover:text-emerald-100"
        }`}
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5" />
        {visibleItems.length ? (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-300 px-1 text-[0.68rem] font-bold text-slate-950">
            {visibleItems.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <button
          type="button"
          aria-label="Close notifications"
          className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-[1px] sm:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {open ? (
        <div
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-[90] max-h-[min(76vh,34rem)] overflow-hidden rounded-2xl border border-white/20 bg-[#1d2832]/96 shadow-2xl backdrop-blur-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:z-auto sm:mt-3 sm:w-[min(24rem,calc(100vw-2rem))]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-100">Notifications</h2>
              <p className="text-xs text-slate-500">Warnings and problems only</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadNotifications}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-amber-200/30 hover:text-amber-100"
                aria-label="Refresh notifications"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-amber-200/30 hover:text-amber-100"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[calc(min(76vh,34rem)-5.5rem)] overflow-y-auto overscroll-contain p-3 sm:max-h-[70vh]">
            {error ? (
              <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div>
            ) : null}

            {!error && loading && !items.length ? (
              <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-400">Checking notifications...</div>
            ) : null}

            {!error && !loading && !visibleItems.length ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-300/15 bg-emerald-400/[0.07] p-4 text-emerald-100">
                <CheckCircle2 className="h-5 w-5" />
                <div>
                  <p className="text-sm font-semibold">Everything healthy</p>
                  <p className="text-xs text-emerald-100/70">No active warnings right now.</p>
                </div>
              </div>
            ) : null}

            {visibleItems.length ? (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <button type="button" onClick={dismissAll} className="text-xs font-semibold text-slate-400 transition hover:text-amber-100">
                    Dismiss all
                  </button>
                </div>
                {visibleItems.map((entry) => {
                  const styles = severityStyles[entry.severity];
                  const Icon = styles.icon;

                  return (
                    <div key={entry.id} className={`rounded-lg border ${styles.border} ${styles.bg} p-3`}>
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon className={`h-4 w-4 shrink-0 ${styles.text}`} />
                          <h3 className="line-clamp-1 text-sm font-semibold text-slate-100">{entry.title}</h3>
                        </div>
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
                      </div>
                      <p className="line-clamp-2 text-xs leading-5 text-slate-300">{entry.message}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
                          {entry.source} · {formatCreatedAt(entry.lastSeenAt || entry.createdAt)}
                          {entry.occurrences > 1 ? ` · ${entry.occurrences}x` : ""}
                        </p>
                        <button type="button" onClick={() => dismiss(entry)} className="text-xs font-semibold text-slate-400 transition hover:text-amber-100">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
