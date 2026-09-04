import { Download, Settings2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { QBittorrentData } from "../types";
import WidgetCard from "./WidgetCard";
import { useWidgetDisplay } from "./WidgetDisplayContext";

interface QBittorrentWidgetProps {
  refreshKey?: number;
}

function etaLabel(seconds: number | null) {
  if (!seconds) {
    return "";
  }

  if (seconds < 3600) {
    return `${Math.ceil(seconds / 60)}m`;
  }

  if (seconds < 86_400) {
    return `${Math.ceil(seconds / 3600)}h`;
  }

  return `${Math.ceil(seconds / 86_400)}d`;
}

function speedLabel(value: number | undefined, unit: "mbps" | "mbs" = "mbps") {
  const numeric = unit === "mbs" ? (value ?? 0) / 8 : value ?? 0;
  const rounded = Number(numeric.toFixed(numeric >= 10 ? 0 : 1));
  return `${rounded} ${unit === "mbs" ? "MB/s" : "Mbps"}`;
}

export default function QBittorrentWidget({ refreshKey = 0 }: QBittorrentWidgetProps) {
  const [data, setData] = useState<QBittorrentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);
  const speedUnit = data?.settings.speedUnit ?? "mbps";
  const dense = useWidgetDisplay() === "dense";

  useEffect(() => {
    let active = true;

    function load() {
      setRefreshing(true);
      api
        .qbittorrent()
        .then((nextData) => {
          if (!active) {
            return;
          }

          setData(nextData);
          setError(null);
        })
        .catch((err: Error) => {
          if (active) {
            setError(err.message);
          }
        })
        .finally(() => {
          if (active) {
            setRefreshing(false);
          }
        });
    }

    load();
    const timer = window.setInterval(load, 5_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [localRefresh, refreshKey]);

  return (
    <>
    <WidgetCard
      title="qBittorrent"
      icon={<Download className={`h-5 w-5 ${refreshing ? "animate-pulse" : ""}`} />}
      status={data?.status ?? "unknown"}
      action={(
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="rounded-lg border border-white/10 bg-white/[0.035] p-1.5 text-slate-400 transition hover:border-amber-200/35 hover:text-amber-100"
          title="Customize qBittorrent widget"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      )}
    >
      {!data?.configured ? (
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
          Configure qBittorrent in Manage &gt; Integrations.
        </div>
      ) : null}

      {error || data?.error ? (
        <div className="mb-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-xs leading-5 text-rose-100">
          {error ?? data?.error}
        </div>
      ) : null}

      <div className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-slate-400">
            <Download className="h-4 w-4 text-cyan-200" />
            Download
          </span>
          <span className="shrink-0 font-semibold text-slate-50">{speedLabel(data?.downloadMbps, speedUnit)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-slate-400">
            <Upload className="h-4 w-4 text-amber-100" />
            Upload
          </span>
          <span className="shrink-0 font-semibold text-slate-50">{speedLabel(data?.uploadMbps, speedUnit)}</span>
        </div>
      </div>

      <div className={`${dense ? "mt-2" : "mt-3"} grid grid-cols-4 gap-1.5 text-center`}>
        {[
          ["Down", data?.downloading ?? 0],
          ["Seed", data?.seeding ?? 0],
          ["Pause", data?.paused ?? 0],
          ["Err", data?.errored ?? 0]
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5">
            <p className={`${dense ? "text-sm" : "text-base"} font-semibold text-slate-100`}>{value}</p>
            <p className="text-[0.62rem] uppercase tracking-[0.1em] text-slate-600">{label}</p>
          </div>
        ))}
      </div>

      <div className={`${dense ? "mt-2 px-2 py-1.5" : "mt-3 px-3 py-2"} rounded-lg border border-white/10 bg-white/[0.035] text-xs leading-5 text-slate-500`}>
        Total {data?.total ?? 0} torrents · {data?.totalDownloadedGb ?? 0} GB down · {data?.totalUploadedGb ?? 0} GB up
        {data?.settings.showNames === false ? <span className="block text-slate-600">Names hidden</span> : null}
      </div>

      {data?.torrents.length ? (
        <div className={`${dense ? "mt-3" : "mt-4"} space-y-2`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active</p>
          {data.torrents.slice(0, dense ? 2 : undefined).map((torrent, index) => (
            <div key={`${torrent.name}-${torrent.state}-${index}`} className={`${dense ? "p-2" : "p-3"} rounded-lg border border-white/10 bg-black/10`}>
              <div className="flex items-start justify-between gap-3">
                <p className="line-clamp-1 min-w-0 text-sm font-semibold text-slate-200">{torrent.name}</p>
                <span className="shrink-0 text-xs text-slate-500">{torrent.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950/60">
                <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, Math.max(0, torrent.progress))}%` }} />
              </div>
              <div className="mt-2 flex justify-between gap-3 text-xs text-slate-500">
                <span className="truncate">{torrent.state}</span>
                <span className="shrink-0">
                  {speedLabel(torrent.downloadMbps, speedUnit)}/{speedLabel(torrent.uploadMbps, speedUnit)} {etaLabel(torrent.etaSeconds)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : data?.configured && !data.error ? (
        <div className="mt-4 rounded-lg border border-emerald-300/10 bg-emerald-300/5 p-3">
          <p className="text-sm font-semibold text-slate-300">No active torrents.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-white/10 bg-black/10 px-3 py-2">
              <p className="font-semibold text-slate-200">{data.total}</p>
              <p className="mt-1 text-slate-500">Total torrents</p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/10 px-3 py-2">
              <p className="font-semibold text-slate-200">{data.settings.showNames ? "Visible" : "Hidden"}</p>
              <p className="mt-1 text-slate-500">Torrent names</p>
            </div>
          </div>
        </div>
      ) : null}
    </WidgetCard>
    {settingsOpen ? (
      <QBittorrentWidgetSettings
        settings={data?.settings ?? { showNames: false, torrentLimit: 5, speedUnit: "mbps" }}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => {
          setSettingsOpen(false);
          setLocalRefresh((value) => value + 1);
        }}
      />
    ) : null}
    </>
  );
}

function QBittorrentWidgetSettings({
  settings,
  onClose,
  onSaved
}: {
  settings: QBittorrentData["settings"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [showNames, setShowNames] = useState(settings.showNames);
  const [torrentLimit, setTorrentLimit] = useState(settings.torrentLimit);
  const [speedUnit, setSpeedUnit] = useState<"mbps" | "mbs">(settings.speedUnit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveSettings() {
    setSaving(true);
    setError(null);

    try {
      await api.updateIntegrations({
        qbittorrent: {
          showNames,
          torrentLimit,
          speedUnit
        }
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save qBittorrent widget settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#202a33] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-100">qBittorrent widget</h3>
            <p className="mt-1 text-xs text-slate-500">Tune torrent display without changing credentials.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/[0.035] p-2 text-slate-400 transition hover:text-slate-100"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-200">
            <span>
              <span className="block font-medium">Show torrent names</span>
              <span className="block text-xs text-slate-500">Hide names if the dashboard is visible to others.</span>
            </span>
            <input
              type="checkbox"
              checked={showNames}
              onChange={(event) => setShowNames(event.target.checked)}
              className="h-4 w-4 accent-amber-300"
            />
          </label>
          <label className="block rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-200">
            <span className="block font-medium">Active torrent rows</span>
            <input
              type="number"
              min={0}
              max={12}
              value={torrentLimit}
              onChange={(event) => setTorrentLimit(Number(event.target.value))}
              className="input mt-2"
            />
          </label>
          <label className="block rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-200">
            <span className="block font-medium">Speed unit</span>
            <select
              value={speedUnit}
              onChange={(event) => setSpeedUnit(event.target.value === "mbs" ? "mbs" : "mbps")}
              className="input mt-2"
            >
              <option value="mbps">Mbps</option>
              <option value="mbs">MB/s</option>
            </select>
          </label>
          {error ? <p className="rounded-lg border border-rose-300/20 bg-rose-300/10 p-3 text-xs leading-5 text-rose-100">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={saving}
              className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
