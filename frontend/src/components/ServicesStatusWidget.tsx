import { Activity, Server } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { ServicesStatusData } from "../types";
import WidgetCard from "./WidgetCard";
import { useWidgetDisplay } from "./WidgetDisplayContext";

interface ServicesStatusWidgetProps {
  refreshKey?: number;
}

export default function ServicesStatusWidget({ refreshKey = 0 }: ServicesStatusWidgetProps) {
  const [data, setData] = useState<ServicesStatusData | null>(null);
  const dense = useWidgetDisplay() === "dense";

  useEffect(() => {
    let active = true;

    function load() {
      api
        .servicesStatus()
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
    const timer = window.setInterval(load, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshKey]);

  const configured = data?.services.filter((service) => service.configured) ?? [];
  const visible = configured.length ? configured : data?.services.slice(0, dense ? 4 : 6) ?? [];

  return (
    <WidgetCard title="Services" icon={<Server className="h-5 w-5" />} status={data?.status ?? "unknown"}>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Metric label="Configured" value={configured.length || "-"} />
        <Metric label="Online" value={configured.filter((service) => service.status === "online").length || "-"} />
        <Metric label="Ready" value={data ? data.services.length : "-"} />
      </div>

      <div className="space-y-2">
        {visible.map((service) => (
          <div key={service.id} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-200">{service.name}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">
                  {service.configured ? service.error ?? service.details?.[0] ?? "Connected service" : "Not configured"}
                </span>
              </span>
              <span className={`flex shrink-0 items-center gap-1.5 text-xs capitalize ${
                service.status === "online" ? "text-emerald-300" : service.status === "offline" ? "text-rose-300" : "text-slate-500"
              }`}>
                <span className={`h-2 w-2 rounded-full ${service.status === "online" ? "bg-emerald-400" : service.status === "offline" ? "bg-rose-400" : "bg-slate-500"}`} />
                {service.status}
              </span>
            </div>
            {service.metrics.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {service.metrics.slice(0, dense ? 2 : 3).map((metric) => (
                  <span key={metric.label} className="rounded-md bg-black/15 px-2 py-1 text-[0.68rem] text-slate-400">
                    {metric.label}: <span className="text-slate-200">{metric.value}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {data && !configured.length ? (
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
            Configure services in Integrations, then enable them for live status.
          </div>
        ) : null}
      </div>
    </WidgetCard>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2">
      <p className="text-base font-semibold text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
