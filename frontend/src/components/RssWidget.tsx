import { Newspaper, RefreshCw, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { RssFeedConfig, RssFeedResult, RssSettings } from "../types";
import RssFeedsModal from "./RssFeedsModal";
import WidgetCard from "./WidgetCard";
import { useWidgetDisplay } from "./WidgetDisplayContext";
import { groupRssItems, selectRssItems } from "./rssSelection";

function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

interface RssWidgetProps {
  refreshKey?: number;
}

export default function RssWidget({ refreshKey = 0 }: RssWidgetProps) {
  const [feeds, setFeeds] = useState<RssFeedResult[]>([]);
  const [settings, setSettings] = useState<RssSettings>({ radarTotalItems: 10 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);
  const dense = useWidgetDisplay() === "dense";

  useEffect(() => {
    let active = true;

    function load(refresh = false) {
      if (!feeds.length) {
        setLoading(true);
      }
      setError(null);

      const request = refresh ? api.refreshRss() : api.rss();
      request
        .then((data) => {
          if (active) {
            setFeeds(data.feeds);
            setSettings(data.rssSettings);
          }
        })
        .catch((err: Error) => {
          if (active) {
            setError(err.message);
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }

    load();
    const timer = window.setInterval(() => load(true), 2 * 60_000);
    const handleFocus = () => {
      if (document.visibilityState !== "hidden") {
        load(true);
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [feeds.length, localRefresh, refreshKey]);

  const selectedGroups = groupRssItems(selectRssItems(feeds, settings.radarTotalItems ?? 10, "radar"));
  const errorFeeds = feeds.filter((feed) => feed.error && !feed.items.length);
  const staleFeeds = feeds.filter((feed) => feed.stale && feed.items.length);
  const hasFeedProblems = Boolean(error || errorFeeds.length || staleFeeds.length);

  async function refreshNow() {
    setRefreshing(true);
    setError(null);

    try {
      const data = await api.refreshRss();
      setFeeds(data.feeds);
      setSettings(data.rssSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "RSS refresh failed");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  return (
    <>
    <WidgetCard
      title="RSS Radar"
      icon={<Newspaper className="h-5 w-5" />}
      status={hasFeedProblems ? "unknown" : "online"}
      action={(
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:border-amber-200/40 hover:text-amber-100"
            aria-label="RSS settings"
            title="RSS settings"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void refreshNow()}
            disabled={refreshing}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:border-amber-200/40 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Refresh RSS feeds"
            title="Refresh RSS feeds"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}
    >
      {loading ? <p className="text-sm text-slate-400">Loading feeds...</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {staleFeeds.length ? (
        <p className="rounded-lg border border-amber-200/10 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100/80">
          Showing cached RSS items for {staleFeeds.map((feed) => feed.feed).join(", ")} because the latest fetch failed.
        </p>
      ) : null}
      <div className={dense ? "space-y-3" : "space-y-4"}>
        {selectedGroups.map((feed) => (
          <div key={feed.feed}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-slate-200">{feed.feed}</h3>
            </div>
            <div className="space-y-2">
              {feed.items.map((item) => (
                <a
                  key={`${feed.feed}-${item.link}`}
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className={`${dense ? "p-2" : "p-3"} block rounded-lg border border-white/5 bg-white/[0.03] transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]`}
                >
                  <p className="line-clamp-2 text-sm leading-5 text-slate-200">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(item.date)}</p>
                </a>
              ))}
            </div>
          </div>
        ))}
        {errorFeeds.map((feed) => (
          <div key={feed.feed} className="rounded-lg border border-rose-300/10 bg-rose-500/5 p-3">
            <div className="mb-1 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-slate-200">{feed.feed}</h3>
              <span className="text-xs text-rose-300">Feed error</span>
            </div>
            <p className="text-xs leading-5 text-slate-500">{feed.error}</p>
          </div>
        ))}
        {!loading && !selectedGroups.length && !errorFeeds.length ? (
          <p className="text-sm text-slate-500">No RSS items available.</p>
        ) : null}
      </div>
    </WidgetCard>
    <RssFeedsModal
      open={settingsOpen}
      saving={savingSettings}
      onClose={() => setSettingsOpen(false)}
      onSave={async (nextFeeds: RssFeedConfig[], nextSettings: RssSettings) => {
        setSavingSettings(true);
        try {
          await api.updateRssFeeds(nextFeeds, nextSettings);
          setSettingsOpen(false);
          setLocalRefresh((value) => value + 1);
        } finally {
          setSavingSettings(false);
        }
      }}
    />
    </>
  );
}
