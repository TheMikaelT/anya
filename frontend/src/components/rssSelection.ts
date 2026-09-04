import type { RssFeedResult, RssItem } from "../types";

export function selectRssItems(
  feeds: RssFeedResult[],
  totalLimit: number,
  mode: "radar" | "ticker"
) {
  const limits = new Map<string, number>();
  const selected: RssItem[] = [];
  const queues = feeds.filter((feed) => !feed.stale).map((feed) => {
    const feedLimit = mode === "radar" ? feed.radarLimit ?? 3 : feed.tickerLimit ?? 2;
    limits.set(feed.feed, feedLimit);

    return {
      feed: feed.feed,
      items: feed.items.slice(0, feedLimit)
    };
  }).filter((feed) => (limits.get(feed.feed) ?? 0) > 0 && feed.items.length > 0);

  let index = 0;

  while (selected.length < totalLimit && queues.some((feed) => feed.items.length > 0)) {
    const queue = queues[index % queues.length];
    const item = queue.items.shift();

    if (item) {
      selected.push(item);
    }

    index += 1;
  }

  return selected;
}

export function groupRssItems(items: RssItem[]) {
  return items.reduce<Array<{ feed: string; items: RssItem[] }>>((groups, item) => {
    const existing = groups.find((group) => group.feed === item.feed);

    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ feed: item.feed, items: [item] });
    }

    return groups;
  }, []);
}
