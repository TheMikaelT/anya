import Parser from "rss-parser";
import type { RssFeedConfig, RssFeedResult, RssItem } from "../types.js";

const parser = new Parser({
  requestOptions: {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "Anya RSS Reader"
    }
  }
});
const staleAfterMs = 3 * 24 * 60 * 60 * 1000;

interface FeedCacheEntry {
  fetchedAt: string;
  items: RssItem[];
}

const feedCache = new Map<string, FeedCacheEntry>();

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parseFeedWithRetry(url: string) {
  try {
    return await parser.parseURL(url);
  } catch (firstError) {
    await wait(800);

    try {
      return await parser.parseURL(url);
    } catch {
      throw firstError;
    }
  }
}

function getLatestItemDate(items: RssItem[]) {
  const timestamps = items
    .map((item) => (item.date ? Date.parse(item.date) : NaN))
    .filter((timestamp) => Number.isFinite(timestamp));

  if (!timestamps.length) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

export function clearRssCache() {
  feedCache.clear();
}

export async function fetchRssFeeds(feeds: RssFeedConfig[]): Promise<RssFeedResult[]> {
  return Promise.all(
    feeds.map(async (feed) => {
      try {
        const parsed = await parseFeedWithRetry(feed.url);
        const items = parsed.items.slice(0, 30).map((item) => ({
          feed: feed.name,
          title: item.title ?? "Untitled",
          link: item.link ?? feed.url,
          date: item.isoDate ?? item.pubDate ?? null
        }));
        const fetchedAt = new Date().toISOString();
        const latestItemDate = getLatestItemDate(items);
        const stale = latestItemDate ? Date.now() - Date.parse(latestItemDate) > staleAfterMs : items.length === 0;
        const error = stale
          ? items.length
            ? `Feed has no recent items. Latest item is from ${latestItemDate?.slice(0, 10)}.`
            : "Feed returned no items."
          : undefined;
        feedCache.set(feed.url, { fetchedAt, items });

        return { feed: feed.name, items, radarLimit: feed.radarLimit, tickerLimit: feed.tickerLimit, fetchedAt, latestItemDate, stale, error };
      } catch (error) {
        const cached = feedCache.get(feed.url);
        const message = error instanceof Error && error.message ? error.message : "RSS fetch failed";

        if (cached?.items.length) {
          return {
            feed: feed.name,
            items: cached.items,
            radarLimit: feed.radarLimit,
            tickerLimit: feed.tickerLimit,
            error: message,
            stale: true,
            fetchedAt: cached.fetchedAt
          };
        }

        return { feed: feed.name, items: [], radarLimit: feed.radarLimit, tickerLimit: feed.tickerLimit, error: message };
      }
    })
  );
}
