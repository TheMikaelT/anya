import { Boxes } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { DockerData } from "../types";
import WidgetCard from "./WidgetCard";
import { useWidgetDisplay } from "./WidgetDisplayContext";

interface DockerWidgetProps {
  refreshKey?: number;
}

export default function DockerWidget({ refreshKey = 0 }: DockerWidgetProps) {
  const [data, setData] = useState<DockerData | null>(null);
  const dense = useWidgetDisplay() === "dense";

  useEffect(() => {
    let active = true;

    function load() {
      api
        .docker()
        .then((nextData) => {
          if (active) {
            setData(nextData);
          }
        })
        .catch(() => {
          if (active) {
            setData(null);
          }
        });
    }

    load();
    const timer = window.setInterval(load, 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshKey]);

  return (
    <WidgetCard title="Docker" icon={<Boxes className="h-5 w-5" />} status={data?.status ?? "unknown"}>
      {data?.error ? (
        <div className="mb-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
          {data.error}
        </div>
      ) : null}
      <div className={`${dense ? "mb-3 gap-2" : "mb-4 gap-3"} grid grid-cols-4`}>
        <div className={`${dense ? "p-2" : "p-3"} rounded-lg border border-emerald-300/10 bg-emerald-300/10`}>
          <p className={`${dense ? "text-base" : "text-xl"} font-semibold text-emerald-100`}>{data?.running ?? "-"}</p>
          <p className="mt-1 text-xs text-emerald-200/70">Running</p>
        </div>
        <div className={`${dense ? "p-2" : "p-3"} rounded-lg border border-slate-500/10 bg-slate-500/10`}>
          <p className={`${dense ? "text-base" : "text-xl"} font-semibold text-slate-100`}>{data?.stopped ?? "-"}</p>
          <p className="mt-1 text-xs text-slate-400">Stopped</p>
        </div>
        <div className={`${dense ? "p-2" : "p-3"} rounded-lg border border-white/5 bg-white/[0.03]`}>
          <p className={`${dense ? "text-base" : "text-xl"} font-semibold text-slate-100`}>{data?.images ?? "-"}</p>
          <p className="mt-1 text-xs text-slate-500">Active images</p>
        </div>
        <div className={`${dense ? "p-2" : "p-3"} rounded-lg border border-white/5 bg-white/[0.03]`}>
          <p className={`${dense ? "text-base" : "text-xl"} font-semibold text-slate-100`}>{data ? `${data.volumeUsageGb} GB` : "-"}</p>
          <p className="mt-1 text-xs text-slate-500">Volumes</p>
        </div>
      </div>
      <div className="space-y-2">
        {(data?.containers ?? []).slice(0, dense ? 3 : undefined).map((container) => (
          <div key={`${container.sourceId ?? "docker"}-${container.name}`} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate text-slate-300">{container.name}</span>
              {container.sourceName ? <span className="block truncate text-xs text-slate-500">{container.sourceName}</span> : null}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {container.status}
            </span>
          </div>
        ))}
        {data && !data.containers.length ? (
          <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-slate-400">No running containers found.</div>
        ) : null}
      </div>
      {data?.stoppedContainers?.length ? (
        <div className={`${dense ? "mt-3" : "mt-4"} space-y-2`}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Stopped</p>
          {data.stoppedContainers.slice(0, dense ? 2 : 5).map((container) => (
            <div key={`${container.sourceId ?? "docker"}-${container.name}-stopped`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-500/10 bg-slate-500/10 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate text-slate-300">{container.name}</span>
                {container.sourceName ? <span className="block truncate text-xs text-slate-500">{container.sourceName}</span> : null}
              </span>
              <span className="shrink-0 truncate text-xs text-slate-400" title={container.status}>
                {container.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className={`${dense ? "mt-3 pt-3" : "mt-4 pt-4"} border-t border-white/10`}>
        {!dense && data?.sources?.length ? (
          <div className="mb-4 space-y-2">
            {data.sources.map((source) => (
              <div key={source.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2 text-xs">
                <span className="min-w-0">
                  <span className="block truncate text-slate-300">{source.name}</span>
                  <span className="block text-slate-500">{source.running} running / {source.stopped} stopped</span>
                </span>
                <span className={`shrink-0 ${source.status === "online" ? "text-emerald-300" : "text-rose-300"}`}>
                  {source.status}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(data?.cpuPercent ?? 0, 100)}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>CPU: {data ? `${data.cpuPercent}%` : "-"}</span>
          <span>RAM: {data ? `${data.memoryUsedGb} GB / ${data.memoryTotalGb} GB` : "-"}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {data?.source === "docker-multi" ? "Live Docker sources" : data?.source === "docker-socket" ? "Live Docker socket" : "Waiting for Docker source"}
        </p>
      </div>
    </WidgetCard>
  );
}
