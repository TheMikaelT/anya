import { Activity, ArrowDown, ArrowUp, Camera, EthernetPort, RadioTower, Router, Server, Users, Wifi } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { UnifiData } from "../types";
import WidgetCard from "./WidgetCard";
import { useWidgetDisplay } from "./WidgetDisplayContext";

interface UnifiWidgetProps {
  refreshKey?: number;
}

export default function UnifiWidget({ refreshKey = 0 }: UnifiWidgetProps) {
  const [data, setData] = useState<UnifiData | null>(null);
  const dense = useWidgetDisplay() === "dense";

  useEffect(() => {
    let active = true;

    function load() {
      api
        .unifi()
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

  return (
    <WidgetCard title="UniFi Network" icon={<RadioTower className="h-5 w-5" />} status={data?.status ?? "unknown"}>
      {data?.error ? (
        <div className="mb-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
          {data.error}
        </div>
      ) : null}
      <div className="grid grid-cols-4 gap-2">
        <NetworkMetric dense={dense} icon={<RadioTower className="h-4 w-4" />} label="APs" value={data?.accessPoints ?? "-"} tone="emerald" />
        <NetworkMetric dense={dense} icon={<Camera className="h-4 w-4" />} label="Cameras" value={data?.cameras ?? "-"} tone="emerald" />
        <NetworkMetric dense={dense} icon={<Users className="h-4 w-4" />} label="Clients" value={data?.clients ?? "-"} />
        <NetworkMetric dense={dense} icon={<Activity className="h-4 w-4" />} label="Latency" value={data ? `${data.latencyMs} ms` : "-"} />
      </div>
      <div className={`${dense ? "mt-2 px-2 py-1.5" : "mt-4 px-3 py-2"} flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] text-xs text-slate-500`}>
        <span className="flex items-center gap-2">
          <ArrowUp className="h-3.5 w-3.5 text-violet-300" />
          Speed {data ? `${data.wanDownloadMbps}/${data.wanUploadMbps} Mbps` : "-"}
        </span>
        <span>
          {data?.source === "mock"
              ? "Waiting for UniFi"
              : `Source ${sourceLabel(data?.source)}`}
        </span>
      </div>
      <div className={`${dense ? "mt-2" : "mt-3"} grid grid-cols-2 gap-2`}>
        <InfoTile
          icon={<ArrowDown className="h-3.5 w-3.5" />}
          label="WAN down"
          value={data?.trafficDownloadMbps !== undefined ? formatTraffic(data.trafficDownloadMbps) : "-"}
        />
        <InfoTile
          icon={<ArrowUp className="h-3.5 w-3.5" />}
          label="WAN up"
          value={data?.trafficUploadMbps !== undefined ? formatTraffic(data.trafficUploadMbps) : "-"}
        />
        <InfoTile icon={<Wifi className="h-3.5 w-3.5" />} label="Wi-Fi clients" value={data?.wifiClients ?? "-"} />
        <InfoTile icon={<EthernetPort className="h-3.5 w-3.5" />} label="Wired clients" value={data?.wiredClients ?? "-"} />
        <InfoTile icon={<Router className="h-3.5 w-3.5" />} label="Gateways" value={data?.gateways ?? "-"} />
        <InfoTile icon={<Server className="h-3.5 w-3.5" />} label="Switches" value={data?.switches ?? "-"} />
        <InfoTile icon={<Users className="h-3.5 w-3.5" />} label="Guest clients" value={data?.guestClients ?? "-"} />
        <InfoTile icon={<Activity className="h-3.5 w-3.5" />} label="Offline devices" value={data?.offlineDevices ?? "-"} />
      </div>
      {data?.deviceSummary?.length ? (
        <div className={`${dense ? "mt-2" : "mt-3"} space-y-1.5`}>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Network devices</p>
          {data.deviceSummary.map((device) => (
            <DeviceRow key={`${device.type}-${device.name}`} device={device} />
          ))}
        </div>
      ) : null}
    </WidgetCard>
  );
}

function formatTraffic(value: number) {
  if (value <= 0) {
    return "0 Kbps";
  }

  if (value < 1) {
    return `${Math.round(value * 1000)} Kbps`;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} Mbps`;
}

function sourceLabel(source?: UnifiData["source"]) {
  if (source === "unifi-os") {
    return "UniFi OS";
  }

  if (source === "legacy") {
    return "Legacy";
  }

  if (source === "mock") {
    return "Mock";
  }

  return "Unknown";
}

function NetworkMetric({
  icon,
  label,
  value,
  tone = "cyan",
  dense = false
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  tone?: "cyan" | "emerald";
  dense?: boolean;
}) {
  const iconTone = tone === "emerald" ? "text-emerald-300" : "text-cyan-300";

  return (
    <div className={`${dense ? "p-2" : "p-3"} rounded-lg border border-white/5 bg-white/[0.03]`}>
      <div className={`${dense ? "mb-1" : "mb-3"} ${iconTone}`}>{icon}</div>
      <p className={`${dense ? "text-sm" : "text-base"} font-semibold text-slate-100`}>{value}</p>
      <p className="mt-0.5 text-[0.68rem] text-slate-500">{label}</p>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/5 bg-black/10 px-3 py-2 text-xs">
      <span className="shrink-0 text-amber-100/80">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-slate-200">{value}</span>
        <span className="block truncate text-slate-500">{label}</span>
      </span>
    </div>
  );
}

function DeviceRow({ device }: { device: NonNullable<UnifiData["deviceSummary"]>[number] }) {
  const online = device.status === "online";
  const detail = [device.type, device.uptimeDays !== undefined ? `${device.uptimeDays}d uptime` : undefined, device.version].filter(Boolean).join(" · ");

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/10 px-3 py-2 text-xs">
      <span className="min-w-0">
        <span className="block truncate font-semibold text-slate-200">{device.name}</span>
        <span className="block truncate text-slate-500">{detail || device.type}</span>
      </span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${online ? "bg-emerald-300/10 text-emerald-200" : "bg-rose-300/10 text-rose-200"}`}>
        {device.status}
      </span>
    </div>
  );
}
