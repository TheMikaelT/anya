import { Loader2, Plus, Rss, Save, Trash2, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { RssFeedConfig, RssSettings } from "../types";

interface RssFeedsModalProps {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (feeds: RssFeedConfig[], settings: RssSettings) => Promise<void>;
}

const emptyFeed: RssFeedConfig = {
  name: "",
  url: "",
  radarLimit: 3,
  tickerLimit: 2
};
const defaultSettings: Required<RssSettings> = {
  radarTotalItems: 10,
  tickerTotalItems: 24,
  tickerSpeedSeconds: 72
};

export default function RssFeedsModal({ open, saving, onClose, onSave }: RssFeedsModalProps) {
  const [feeds, setFeeds] = useState<RssFeedConfig[]>([]);
  const [settings, setSettings] = useState<Required<RssSettings>>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLoading(true);
    setError(null);
    api
      .rssFeeds()
      .then((data) => {
        setFeeds(data.rssFeeds.length ? data.rssFeeds.map(normalizeFeed) : [{ ...emptyFeed }]);
        setSettings({ ...defaultSettings, ...data.rssSettings });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) {
    return null;
  }

  function updateFeed(index: number, field: keyof RssFeedConfig, value: string) {
    setFeeds((current) => current.map((feed, feedIndex) => (
      feedIndex === index
        ? { ...feed, [field]: field === "radarLimit" || field === "tickerLimit" ? Number(value) : value }
        : feed
    )));
  }

  function addFeed() {
    setFeeds((current) => [...current, { ...emptyFeed }]);
  }

  function removeFeed(index: number) {
    setFeeds((current) => {
      const next = current.filter((_, feedIndex) => feedIndex !== index);
      return next.length ? next : [{ ...emptyFeed }];
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const cleanedFeeds = feeds
      .map((feed) => ({
        name: feed.name.trim(),
        url: feed.url.trim(),
        radarLimit: Number(feed.radarLimit ?? emptyFeed.radarLimit),
        tickerLimit: Number(feed.tickerLimit ?? emptyFeed.tickerLimit)
      }))
      .filter((feed) => feed.name || feed.url);

    const incompleteFeed = cleanedFeeds.find((feed) => !feed.name || !feed.url);
    if (incompleteFeed) {
      setError("Feed name and URL are both required.");
      return;
    }

    try {
      await onSave(cleanedFeeds, settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "RSS feed save failed");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 backdrop-blur sm:items-center sm:justify-center">
      <form onSubmit={handleSubmit} className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-white/10 bg-deck-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-100/80">RSS</p>
            <h2 className="text-xl font-semibold text-white">RSS feeds</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Add the feeds you want shown in the RSS widget.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close RSS feeds"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {error ? <div className="mb-4 rounded-xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div> : null}

          <div className="mb-4 grid gap-3 rounded-xl border border-white/10 bg-black/10 p-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Radar total</span>
              <select
                value={settings.radarTotalItems}
                onChange={(event) => setSettings((current) => ({ ...current, radarTotalItems: Number(event.target.value) }))}
                className="input"
              >
                {[3, 5, 10, 15, 20, 30].map((value) => <option key={value} value={value}>{value} news</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Top bar total</span>
              <select
                value={settings.tickerTotalItems}
                onChange={(event) => setSettings((current) => ({ ...current, tickerTotalItems: Number(event.target.value) }))}
                className="input"
              >
                {[6, 12, 18, 24, 36, 48].map((value) => <option key={value} value={value}>{value} news</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Top bar speed</span>
              <select
                value={settings.tickerSpeedSeconds}
                onChange={(event) => setSettings((current) => ({ ...current, tickerSpeedSeconds: Number(event.target.value) }))}
                className="input"
              >
                {[45, 60, 72, 90, 120].map((value) => <option key={value} value={value}>{value}s</option>)}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading feeds...
            </div>
          ) : (
            <div className="space-y-3">
              {feeds.map((feed, index) => (
                <div key={index} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(8rem,0.35fr)_minmax(0,1fr)_7rem_7rem_auto] sm:items-end">
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Name</span>
                      <input
                        value={feed.name}
                        onChange={(event) => updateFeed(index, "name", event.target.value)}
                        className="input"
                        placeholder="ServeTheHome"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Feed URL</span>
                      <input
                        value={feed.url}
                        onChange={(event) => updateFeed(index, "url", event.target.value)}
                        className="input"
                        placeholder="https://www.servethehome.com/feed/"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Radar</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={feed.radarLimit ?? 3}
                        onChange={(event) => updateFeed(index, "radarLimit", event.target.value)}
                        className="input"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Top bar</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={feed.tickerLimit ?? 2}
                        onChange={(event) => updateFeed(index, "tickerLimit", event.target.value)}
                        className="input"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeFeed(index)}
                      className="flex h-12 w-full items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300 sm:w-12"
                      aria-label="Remove RSS feed"
                      title="Remove RSS feed"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addFeed}
            disabled={loading || saving}
            className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add feed
          </button>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Rss className="h-4 w-4 text-amber-200" />
            Failed feeds will show an error in the widget without stopping Anya.
          </div>
          <button
            type="submit"
            disabled={loading || saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save feeds"}
          </button>
        </div>
      </form>
    </div>
  );
}

function normalizeFeed(feed: RssFeedConfig): RssFeedConfig {
  return {
    ...feed,
    radarLimit: feed.radarLimit ?? emptyFeed.radarLimit,
    tickerLimit: feed.tickerLimit ?? emptyFeed.tickerLimit
  };
}
