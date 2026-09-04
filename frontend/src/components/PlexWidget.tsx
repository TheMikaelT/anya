import { Film, Monitor, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { PlexData } from "../types";
import WidgetCard from "./WidgetCard";
import { useWidgetDisplay } from "./WidgetDisplayContext";

interface PlexWidgetProps {
  refreshKey?: number;
}

export default function PlexWidget({ refreshKey = 0 }: PlexWidgetProps) {
  const [data, setData] = useState<PlexData | null>(null);
  const [brokenPosters, setBrokenPosters] = useState<Record<string, boolean>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);
  const dense = useWidgetDisplay() === "dense";
  const showRecentlyAdded = data?.settings?.showRecentlyAdded !== false;

  useEffect(() => {
    let active = true;

    function load() {
      api
        .plex()
        .then((nextData) => {
          if (active) {
            setData(nextData);
            setBrokenPosters({});
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
  }, [localRefresh, refreshKey]);

  return (
    <>
    <WidgetCard
      title="Plex"
      icon={<Film className="h-5 w-5" />}
      status={data?.status ?? "unknown"}
      action={(
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="rounded-lg border border-white/10 bg-white/[0.035] p-1.5 text-slate-400 transition hover:border-amber-200/35 hover:text-amber-100"
          title="Customize Plex widget"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      )}
    >
      {data?.error ? (
        <div className="mb-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
          {data.error}
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <Metric dense={dense} label="Streams" value={data?.activeStreams ?? "-"} />
        <Metric dense={dense} label="Libraries" value={data?.libraries ?? "-"} />
        <Metric dense={dense} label="Media" value={data?.mediaLabel ?? "-"} />
      </div>
      <div className={`${dense ? "mt-3 pt-3" : "mt-4 pt-4"} border-t border-white/10`}>
        <p className={`${dense ? "mb-2" : "mb-3"} text-xs uppercase tracking-[0.16em] text-slate-500`}>Recent activity</p>
        <div className="space-y-1.5">
          {(data?.recentActivity ?? []).slice(0, dense ? 1 : undefined).map((activity) => (
            <div key={`${activity.title}-${activity.client}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-300">{activity.title}</span>
              <span
                className={`shrink-0 text-xs font-medium capitalize ${
                  activity.status === "playing" ? "text-emerald-300" : "text-amber-300"
                }`}
              >
                {activity.status}
              </span>
              <span className="hidden shrink-0 items-center gap-1 text-xs text-slate-500 sm:flex lg:hidden xl:flex">
                {activity.client}
                <Monitor className="h-3.5 w-3.5" />
              </span>
            </div>
          ))}
          {!data?.recentActivity?.length ? <p className="text-sm text-slate-500">No active sessions.</p> : null}
        </div>
      </div>
      {showRecentlyAdded ? (
        <div className={dense ? "mt-3" : "mt-4"}>
          <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-500">Recently added</p>
          <div className="grid grid-cols-3 gap-2">
            {(data?.recentlyAdded ?? []).slice(0, 3).map((item) => {
              const posterKey = item.posterUrl || item.title;
              const showPoster = Boolean(item.posterUrl) && !brokenPosters[posterKey];

              return (
                <div key={item.title} className="min-w-0">
                  <div className="aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                    {showPoster ? (
                      <img
                        src={item.posterUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => setBrokenPosters((current) => ({ ...current, [posterKey]: true }))}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-600">
                        <Film className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-300" title={item.title}>
                    {item.title}
                  </p>
                </div>
              );
            })}
            {data && !data.recentlyAdded.length ? <p className="text-sm text-slate-500">No recent additions found.</p> : null}
          </div>
        </div>
      ) : null}
    </WidgetCard>
    {settingsOpen ? (
      <PlexWidgetSettings
        showRecentlyAdded={showRecentlyAdded}
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

function PlexWidgetSettings({
  showRecentlyAdded,
  onClose,
  onSaved
}: {
  showRecentlyAdded: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nextShowRecentlyAdded, setNextShowRecentlyAdded] = useState(showRecentlyAdded);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveSettings() {
    setSaving(true);
    setError(null);

    try {
      await api.updateIntegrations({
        plex: {
          showRecentlyAdded: nextShowRecentlyAdded
        }
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Plex widget settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#202a33] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-100">Plex widget</h3>
            <p className="mt-1 text-xs text-slate-500">Choose what the Plex card shows.</p>
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
              <span className="block font-medium">Show Recently Added</span>
              <span className="block text-xs text-slate-500">Display poster thumbnails on the Plex widget.</span>
            </span>
            <input
              type="checkbox"
              checked={nextShowRecentlyAdded}
              onChange={(event) => setNextShowRecentlyAdded(event.target.checked)}
              className="h-4 w-4 accent-amber-300"
            />
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

function Metric({ label, value, dense = false }: { label: string; value: number | string; dense?: boolean }) {
  return (
    <div className={`${dense ? "p-2" : "p-3"} rounded-lg border border-white/5 bg-white/[0.03]`}>
      <p className={`${dense ? "text-base" : "text-lg"} font-semibold text-slate-100`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}
