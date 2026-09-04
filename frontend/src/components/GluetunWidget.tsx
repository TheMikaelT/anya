import { RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { GluetunData } from "../types";
import WidgetCard from "./WidgetCard";
import { useWidgetDisplay } from "./WidgetDisplayContext";

interface GluetunWidgetProps {
  refreshKey?: number;
}

function shortIp(value: string | null) {
  if (!value) {
    return "Detecting";
  }

  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-5)}`;
}

function timeLabel(value?: string) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

export default function GluetunWidget({ refreshKey = 0 }: GluetunWidgetProps) {
  const [data, setData] = useState<GluetunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const dense = useWidgetDisplay() === "dense";

  async function load(active = true) {
    setRefreshing(true);

    try {
      const nextData = await api.gluetun();

      if (active) {
        setData(nextData);
        setError(null);
      }
    } catch (err) {
      if (active) {
        setError(err instanceof Error ? err.message : "VPN check failed");
      }
    } finally {
      if (active) {
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    let active = true;

    void load(active);
    const timer = window.setInterval(() => void load(active), 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshKey]);

  const protectedState = data?.protected && !data.leakDetected;
  const title = protectedState ? "Protected" : data?.leakDetected ? "Leak detected" : "Check needed";

  return (
    <WidgetCard
      title="VPN Shield"
      icon={protectedState ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
      status={data?.status ?? "unknown"}
      action={(
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:border-amber-200/40 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Refresh VPN check"
          title="Refresh VPN check"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      )}
    >
      {!data?.configured ? (
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
          Configure Gluetun VPN in Manage &gt; Integrations.
        </div>
      ) : null}

      {error || data?.error ? (
        <div className="mb-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-xs leading-5 text-rose-100">
          {error ?? data?.error}
        </div>
      ) : null}

      <div className={`rounded-xl border ${protectedState ? "border-emerald-300/20 bg-emerald-300/10" : "border-amber-300/20 bg-amber-300/10"} p-3`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">VPN route</p>
        <p className={`${dense ? "text-xl" : "text-2xl"} mt-1 font-semibold text-slate-50`}>{title}</p>
        <p className="mt-1 text-xs text-slate-400">
          {data?.container ?? "gluetun"} · {data?.source === "control-server" ? "Control server" : data?.dockerSourceName ?? "Docker"}
        </p>
      </div>

      <div className={`${dense ? "mt-2" : "mt-3"} grid grid-cols-2 gap-2 text-sm`}>
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
          <p className="text-xs text-slate-500">VPN IP</p>
          <p className="mt-1 truncate font-semibold text-slate-100" title={data?.vpnIp ?? undefined}>{shortIp(data?.vpnIp ?? null)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
          <p className="text-xs text-slate-500">Host IP</p>
          <p className="mt-1 truncate font-semibold text-slate-100" title={data?.hostIp ?? undefined}>{shortIp(data?.hostIp ?? null)}</p>
        </div>
      </div>

      <div className={`${dense ? "mt-2" : "mt-3"} rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs leading-5 text-slate-400`}>
        <div className="flex justify-between gap-3">
          <span>Location</span>
          <span className="truncate text-slate-200">{[data?.city, data?.country].filter(Boolean).join(", ") || "Unknown"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Provider</span>
          <span className="truncate text-slate-200">{data?.provider ?? "Unknown"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Source</span>
          <span className="truncate text-slate-200">{data?.source === "control-server" ? "Control server" : "Docker exec"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Checked</span>
          <span className="text-slate-200">{timeLabel(data?.checkedAt)}</span>
        </div>
      </div>
    </WidgetCard>
  );
}
