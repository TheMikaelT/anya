import { Activity, ChevronDown, CheckCircle2, Clock3, HelpCircle, RefreshCw, TriangleAlert, X, XCircle } from "lucide-react";
import { useState } from "react";
import type { HealthOverviewResponse, HealthStatus } from "../types";

interface HealthOverviewWidgetProps {
  data: HealthOverviewResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onHide: () => void;
}

const statusStyles: Record<HealthStatus, { dot: string; text: string; border: string; bg: string; icon: typeof CheckCircle2 }> = {
  healthy: {
    dot: "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.55)]",
    text: "text-emerald-200",
    border: "border-emerald-300/15",
    bg: "bg-emerald-400/[0.07]",
    icon: CheckCircle2
  },
  warning: {
    dot: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.42)]",
    text: "text-amber-100",
    border: "border-amber-200/18",
    bg: "bg-amber-300/[0.08]",
    icon: TriangleAlert
  },
  error: {
    dot: "bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.45)]",
    text: "text-rose-100",
    border: "border-rose-300/20",
    bg: "bg-rose-400/[0.08]",
    icon: XCircle
  },
  unknown: {
    dot: "bg-slate-500",
    text: "text-slate-300",
    border: "border-slate-300/10",
    bg: "bg-slate-400/[0.06]",
    icon: HelpCircle
  }
};

function formatChecked(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function HealthOverviewWidget({ data, loading, error, onRefresh, onHide }: HealthOverviewWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const overall = data?.overallStatus ?? "unknown";
  const overallStyle = statusStyles[overall];
  const attentionItems = data?.items.filter((entry) => entry.status === "error" || entry.status === "warning").slice(0, 4) ?? [];

  return (
    <section className="rounded-xl border border-white/10 bg-[#26323d]/70 p-3 shadow-glow backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="text-amber-100">
            <Activity className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">Health</h2>
              <span className={`flex items-center gap-1.5 text-xs capitalize ${overallStyle.text}`}>
                <span className={`h-2 w-2 rounded-full ${overallStyle.dot}`} />
                {overall}
              </span>
            </div>
            <p className="truncate text-xs text-slate-400">
              {loading && !data ? "Checking..." : attentionItems.length ? attentionItems.map((entry) => `${entry.name}: ${entry.message}`).join(" · ") : "Everything important looks calm"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-amber-200/30 hover:text-amber-100"
            aria-label={expanded ? "Collapse health overview" : "Expand health overview"}
          >
            <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-amber-200/30 hover:text-amber-100"
            aria-label="Refresh health overview"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onHide}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-rose-200/30 hover:text-rose-100"
            aria-label="Hide health overview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div>
      ) : null}

      {loading && !data ? (
        <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-400">Checking homelab health...</div>
      ) : null}

      {data && expanded ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((entry) => {
            const styles = statusStyles[entry.status];
            const StatusIcon = styles.icon;

            return (
              <div key={entry.name} className={`rounded-lg border ${styles.border} ${styles.bg} p-2.5`}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusIcon className={`h-4 w-4 shrink-0 ${styles.text}`} />
                    <h3 className="truncate text-sm font-semibold text-slate-100">{entry.name}</h3>
                  </div>
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
                </div>
                <p className="line-clamp-1 text-xs leading-5 text-slate-300">{entry.message}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[0.68rem] text-slate-500">
                  <Clock3 className="h-3 w-3" />
                  {formatChecked(entry.lastChecked)}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
