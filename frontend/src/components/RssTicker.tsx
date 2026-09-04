import { RefreshCw, Rss } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { RssItem, RssSettings } from "../types";
import { selectRssItems } from "./rssSelection";

interface RssTickerProps {
  refreshKey?: number;
}

export default function RssTicker({ refreshKey = 0 }: RssTickerProps) {
  const [items, setItems] = useState<RssItem[]>([]);
  const [settings, setSettings] = useState<RssSettings>({ tickerTotalItems: 24, tickerSpeedSeconds: 72 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorFeeds, setErrorFeeds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    function load(refresh = false) {
      if (!items.length) {
        setLoading(true);
      }

      const request = refresh ? api.refreshRss() : api.rss();
      request
        .then((data) => {
          if (!active) {
            return;
          }

          setSettings(data.rssSettings);
          setItems(selectRssItems(data.feeds, data.rssSettings.tickerTotalItems ?? 24, "ticker"));
          setErrorFeeds(data.feeds.filter((feed) => feed.stale || (feed.error && !feed.items.length)).map((feed) => feed.feed));
        })
        .catch(() => {
          if (active) {
            setErrorFeeds(["RSS"]);
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
  }, [items.length, refreshKey]);

  const tickerItems = useMemo(() => {
    if (items.length) {
      return [...items, ...items];
    }

    return [];
  }, [items]);

  if (!loading && !tickerItems.length && !errorFeeds.length) {
    return null;
  }

  async function refreshNow() {
    setRefreshing(true);

    try {
      const data = await api.refreshRss();
      setSettings(data.rssSettings);
      setItems(selectRssItems(data.feeds, data.rssSettings.tickerTotalItems ?? 24, "ticker"));
      setErrorFeeds(data.feeds.filter((feed) => feed.stale || (feed.error && !feed.items.length)).map((feed) => feed.feed));
    } catch {
      setErrorFeeds(["RSS"]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  return (
    <section className="rss-ticker-shell overflow-hidden rounded-xl border border-white/10 bg-[#25313b]/80 shadow-glow backdrop-blur">
      <div className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)_auto] items-center sm:min-h-12">
        <div className="flex h-full items-center gap-2 border-r border-white/10 bg-black/10 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-amber-100 sm:px-4 sm:text-xs sm:tracking-[0.16em]">
          <Rss className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          RSS
        </div>
        <div className="relative overflow-hidden py-2 sm:py-3">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#25313b] to-transparent sm:w-12" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#25313b] to-transparent sm:w-12" />
          {tickerItems.length ? (
            <div
              className="rss-ticker-track flex w-max items-center gap-6 whitespace-nowrap px-5 sm:gap-8 sm:px-8"
              style={{ "--rss-ticker-duration": `${settings.tickerSpeedSeconds ?? 72}s` } as CSSProperties}
            >
              {tickerItems.map((item, index) => (
                <a
                  key={`${item.feed}-${item.link}-${index}`}
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-2 text-xs text-slate-300 transition hover:text-amber-100 sm:gap-3 sm:text-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80" />
                  <span className="font-medium text-slate-200 group-hover:text-amber-100">{item.feed}</span>
                  <span className="max-w-[42rem] overflow-hidden text-ellipsis">{item.title}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="px-5 text-xs text-slate-400 sm:px-8 sm:text-sm">
              {loading ? "Loading RSS feeds..." : `RSS unavailable: ${errorFeeds.join(", ")}`}
            </p>
          )}
        </div>
        <div className="flex h-full items-center border-l border-white/10 bg-black/10 px-1.5 sm:px-2">
          <button
            type="button"
            onClick={() => void refreshNow()}
            disabled={refreshing}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50 sm:p-2"
            aria-label="Refresh RSS feeds"
            title="Refresh RSS feeds"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </section>
  );
}
