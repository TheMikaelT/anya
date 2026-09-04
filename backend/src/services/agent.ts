import type { DashboardConfig } from "../types.js";
import Parser from "rss-parser";
import { getDockerWidgetData } from "./docker.js";
import { getGluetunWidgetData } from "./gluetun.js";
import { getPlexWidgetData } from "./plex.js";
import { getQBittorrentWidgetData } from "./qbittorrent.js";
import { fetchRssFeeds } from "./rss.js";
import { getUnifiWidgetData } from "./unifi.js";
import { loadAssistantSessionMemory, saveAssistantSessionMemory, type AssistantSubjectKind } from "./assistantMemory.js";

export interface AgentQuickResult {
  response: string;
  sources: string[];
  checkedAt: string;
}

interface AgentMemory {
  lastSubject?: string;
  lastSearchSubject?: string;
  lastSubjectKind?: AssistantSubjectKind;
  lastTool?: string;
  updatedAt: number;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

type AgentIntent =
  | { type: "plex-recent"; index: number }
  | { type: "news" }
  | { type: "wikipedia-summary" }
  | { type: "web-followup" }
  | { type: "web-search" }
  | { type: "vpn" }
  | { type: "unifi" }
  | { type: "docker" }
  | { type: "qbittorrent" }
  | { type: "plex-status" }
  | { type: "unknown" };

interface NewsFeedSource {
  name: string;
  url: string;
}

interface NewsItem {
  feed: string;
  title: string;
  link?: string;
  date: string | null;
}

const agentMemory = new Map<string, AgentMemory>();
const directAnswerCache = new Map<string, AgentQuickResult & { expiresAt: number; staleUntil: number }>();
const newsParser = new Parser({
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "User-Agent": "Anya News Reader"
  }
});

const builtInNewsFeeds: Record<string, NewsFeedSource[]> = {
  bbc: [
    { name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
    { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" }
  ],
  cnn: [
    { name: "CNN", url: "http://rss.cnn.com/rss/edition.rss" },
    { name: "CNN World", url: "http://rss.cnn.com/rss/edition_world.rss" }
  ],
  "new york": [{ name: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" }],
  nytimes: [{ name: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" }],
  nyt: [{ name: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" }]
};

function lowerQuestion(question: string) {
  return question.toLowerCase();
}

function normalizedQuestion(question: string) {
  return lowerQuestion(question)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}#.\s:-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sessionKey(sessionId?: string) {
  return sessionId?.trim() || "default";
}

async function remember(sessionId: string | undefined, patch: Partial<AgentMemory>) {
  const key = sessionKey(sessionId);
  const memory = {
    ...agentMemory.get(key),
    ...patch,
    updatedAt: Date.now()
  };

  agentMemory.set(key, memory);
  await saveAssistantSessionMemory(sessionId, memory);
}

async function recall(sessionId?: string) {
  const memory = agentMemory.get(sessionKey(sessionId));

  if (memory && Date.now() - memory.updatedAt <= 30 * 60_000) {
    return memory;
  }

  const persisted = await loadAssistantSessionMemory(sessionId);

  if (!persisted || Date.now() - persisted.updatedAt > 24 * 60 * 60_000) {
    return undefined;
  }

  agentMemory.set(sessionKey(sessionId), persisted);
  return persisted;
}

async function cachedDirectAnswer(key: string, work: () => Promise<AgentQuickResult>, timeoutMs = 1400, ttlMs = 20_000) {
  const now = Date.now();
  const cached = directAnswerCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("quick check timed out")), timeoutMs);
      })
    ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    directAnswerCache.set(key, {
      ...result,
      expiresAt: Date.now() + ttlMs,
      staleUntil: Date.now() + 5 * 60_000
    });

    return result;
  } catch {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (cached && cached.staleUntil > now) {
      return {
        response: `Viimeisin tieto: ${cached.response}`,
        sources: cached.sources,
        checkedAt: cached.checkedAt
      };
    }

    return {
      response: "Tarkistus kestää tavallista kauemmin. Katso widgetistä viimeisin tila.",
      sources: [key],
      checkedAt: new Date().toISOString()
    };
  }
}

function isLatestPlexQuestion(question: string) {
  const normalized = normalizedQuestion(question);
  const asksLatest = /(viimeksi|viimeinen|viimeisin|viimeisimmat|uusin|latest|recent|recently|asken)/.test(normalized);
  const asksAdded = /(lisat|lisatty|added|tullut|ilmestynyt)/.test(normalized);
  const asksPlex = /(plex|pleks|elokuva|leffa|movie|media|sarja|show)/.test(normalized);

  return (asksLatest || hasOrdinal(question)) && (asksAdded || asksPlex);
}

function isPlexLatestOnlyQuestion(question: string, memory?: AgentMemory) {
  const normalized = normalizedQuestion(question);
  const asksLatest = /(viimeksi|viimeinen|viimeisin|viimeisimmat|uusin|latest|recent|recently|asken)/.test(normalized);
  const asksAdded = /(lisat|lisatty|added|tullut|ilmestynyt)/.test(normalized);
  const explicitPlex = /(plex|pleks|elokuva|leffa|movie|media|sarja|show)/.test(normalized);
  const shortFollowUp = memory?.lastTool?.startsWith("plex") && /(mikä|mitä|kerro|toista|uudestaan|viimeksi)/.test(normalized);

  return (asksLatest || hasOrdinal(question)) && (asksAdded || explicitPlex || Boolean(shortFollowUp));
}

const finnishOrdinalIndex: Array<[RegExp, number]> = [
  [/\b(ensimmainen|ensimmaiseksi|ykkonen|ykkoseksi|eka|ekaksi|1\.?|#1|first)\b/, 0],
  [/\b(toinen|toiseksi|kakkonen|kakkoseksi|2\.?|#2|second)\b/, 1],
  [/\b(kolmas|kolmanneksi|kolmonen|kolmoseksi|3\.?|#3|third)\b/, 2],
  [/\b(neljas|neljanneksi|nelonen|neloseksi|4\.?|#4|fourth)\b/, 3],
  [/\b(viides|viidenneksi|vitonen|vitoseksi|5\.?|#5|fifth)\b/, 4],
  [/\b(kuudes|kuudenneksi|kutonen|kutoseksi|6\.?|#6|sixth)\b/, 5],
  [/\b(seitsemas|seitsemanneksi|seiska|seiskaksi|7\.?|#7|seventh)\b/, 6],
  [/\b(kahdeksas|kahdeksanneksi|kasi|kasiksi|8\.?|#8|eighth)\b/, 7],
  [/\b(yhdeksas|yhdeksanneksi|ysi|ysiksi|9\.?|#9|ninth)\b/, 8],
  [/\b(kymmenes|kymmenenneksi|10\.?|#10|tenth)\b/, 9],
  [/\b(yhdestoista|yhdenneksitoista|11\.?|#11|eleventh)\b/, 10],
  [/\b(kahdestoista|kahdenneksitoista|12\.?|#12|twelfth)\b/, 11],
  [/\b(kolmastoista|kolmanneksitoista|13\.?|#13|thirteenth)\b/, 12],
  [/\b(neljastoista|neljanneksitoista|14\.?|#14|fourteenth)\b/, 13],
  [/\b(viidestoista|viidenneksitoista|15\.?|#15|fifteenth)\b/, 14],
  [/\b(kuudestoista|kuudenneksitoista|16\.?|#16|sixteenth)\b/, 15],
  [/\b(seitsemastoista|seitsemanneksitoista|17\.?|#17|seventeenth)\b/, 16],
  [/\b(kahdeksastoista|kahdeksanneksitoista|18\.?|#18|eighteenth)\b/, 17],
  [/\b(yhdeksastoista|yhdeksanneksitoista|19\.?|#19|nineteenth)\b/, 18],
  [/\b(kahdeskymmenes|kahdenneksikymmenes|20\.?|#20|twentieth)\b/, 19]
];

function hasOrdinal(question: string) {
  const normalized = normalizedQuestion(question);

  return finnishOrdinalIndex.some(([pattern]) => pattern.test(normalized)) || /(?:^|\s|#)([1-9]|1[0-9]|20)\.?(?=\s|$)/.test(normalized);
}

function ordinalIndex(question: string) {
  const normalized = normalizedQuestion(question);
  const numeric = normalized.match(/(?:^|\s|#)([1-9]|1[0-9]|20)\.?(?=\s|$)/);

  if (numeric?.[1]) {
    return Number(numeric[1]) - 1;
  }

  for (const [pattern, index] of finnishOrdinalIndex) {
    if (pattern.test(normalized)) {
      return index;
    }
  }

  return 0;
}

function plexRecentIndex(question: string) {
  return ordinalIndex(question);
}

function plexRecentLabel(index: number) {
  const labels = [
    "Viimeksi",
    "Toiseksi viimeksi",
    "Kolmanneksi viimeksi",
    "Neljänneksi viimeksi",
    "Viidenneksi viimeksi",
    "Kuudenneksi viimeksi",
    "Seitsemänneksi viimeksi",
    "Kahdeksanneksi viimeksi",
    "Yhdeksänneksi viimeksi",
    "Kymmenenneksi viimeksi"
  ];

  return labels[index] ?? `${index + 1}. viimeksi`;
}

function asksForWeb(question: string, memory?: AgentMemory) {
  const normalized = normalizedQuestion(question);

  if (/hae verkosta|etsi verkosta|hae|etsi|web|netist|google|searx|uutis|arvostel|review|imdb|rotten|wikipedia|wikipediasta|plot|juoni/.test(normalized)) {
    return true;
  }

  return Boolean(memory?.lastSubject && /(onko se hyva|mika se on|kerro siita|arvostel|review|nayttelij|traileri|vuosi|ohjaaja|kannattaako|suositteletko|katsoa|katsomisen arvoinen)/.test(normalized));
}

function asksForOpinionOrInfo(question: string, memory?: AgentMemory) {
  const normalized = normalizedQuestion(question);

  return Boolean(
    memory?.lastSubject &&
      /(onko se hyva|onko hyva|mika se on|kerro siita|arvostel|review|nayttelij|traileri|vuosi|ohjaaja|kuka siina|mista kertoo|kannattaako|suositteletko|katsoa|katsomisen arvoinen)/.test(normalized)
  );
}

function asksForNews(question: string) {
  return /uutis|uutisia|news|headlines|otsik/.test(normalizedQuestion(question));
}

function asksForWikipediaSummary(question: string) {
  const normalized = normalizedQuestion(question);
  return /(wikipedia|wikipediasta|plot|juoni)/.test(normalized);
}

function classifyIntent(question: string, memory?: AgentMemory): AgentIntent {
  const normalized = normalizedQuestion(question);

  if (isPlexLatestOnlyQuestion(question, memory) || isLatestPlexQuestion(question)) {
    return { type: "plex-recent", index: plexRecentIndex(question) };
  }

  if (asksForNews(question)) return { type: "news" };
  if (asksForWikipediaSummary(question)) return { type: "wikipedia-summary" };
  if (asksForOpinionOrInfo(question, memory)) return { type: "web-followup" };
  if (asksForWeb(question, memory)) return { type: "web-search" };
  if (/vpn|gluetun|suoja|leak|vuoto/.test(normalized)) return { type: "vpn" };
  if (/unifi|verkko|wifi|ap|kamera|client|latency/.test(normalized)) return { type: "unifi" };
  if (/docker|kontti|container|stopped|pysaht/.test(normalized)) return { type: "docker" };
  if (/qbit|torrent|lataa|download|seed/.test(normalized)) return { type: "qbittorrent" };
  if (/plex|pleks|media|juliste|stream|kirjasto|elokuva|leffa|movie/.test(normalized)) return { type: "plex-status" };

  return { type: "unknown" };
}

function cleanSearchQuery(question: string) {
  return question
    .replace(/\b(hae|etsi)\s+(verkosta|netistä|webistä)\b/gi, "")
    .replace(/\b(hae|etsi)\b/gi, "")
    .replace(/\b(search|google|searxng|searx)\b/gi, "")
    .replace(/\b(wikipediasta)\b/gi, "wikipedia")
    .replace(/\b(elokuva|leffa)\s+(plot|juoni)\b/gi, "$2")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanNewsQuery(question: string) {
  const query = cleanSearchQuery(question)
    .replace(/\b(hae|etsi)\b/gi, "")
    .replace(/\b(uutis(?:ia|et)?|news|headlines|otsikot|latest|tuoreimmat)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/bbc/i.test(question) && !query) return "BBC";
  if (/cnn/i.test(question) && !query) return "CNN";

  return query || question;
}

function preferredFeedNames(question: string) {
  const normalized = lowerQuestion(question);
  const names: string[] = [];

  if (/bbc/.test(normalized)) names.push("bbc");
  if (/cnn/.test(normalized)) names.push("cnn");
  if (/new york times|nytimes|nyt/.test(normalized)) names.push("new york", "nytimes", "nyt");
  if (/ars/.test(normalized)) names.push("ars");

  return names;
}

function builtInFeedsForQuestion(question: string): NewsFeedSource[] {
  const names = preferredFeedNames(question);
  const matched = names.flatMap((name) => builtInNewsFeeds[name] ?? []);
  const seen = new Set<string>();

  return matched.filter((feed) => {
    if (seen.has(feed.url)) {
      return false;
    }

    seen.add(feed.url);
    return true;
  });
}

function comparableFeedUrl(url: string) {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
}

function comparableTitle(title: string) {
  return title.replace(/\s+/g, " ").trim().toLowerCase();
}

function searchUrl(config: DashboardConfig, query: string) {
  const template = config.search?.urlTemplate?.trim();

  if (!template || !template.includes("{query}")) {
    return null;
  }

  const url = new URL(template.replace("{query}", encodeURIComponent(query)));
  if (/searx/i.test(url.hostname) || /searx/i.test(url.pathname) || config.search?.label?.toLowerCase().includes("searx")) {
    url.searchParams.set("format", "json");
    return url;
  }

  return null;
}

async function searchWeb(config: DashboardConfig, query: string): Promise<WebSearchResult[]> {
  const url = searchUrl(config, query);

  if (!url) {
    return [];
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Anya/0.1 LAN dashboard"
    },
    signal: AbortSignal.timeout(6000)
  });

  if (!response.ok) {
    throw new Error(`Search returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; snippet?: string }>;
  };

  return (payload.results ?? [])
    .map((item) => ({
      title: item.title?.trim() ?? "",
      url: item.url?.trim() ?? "",
      snippet: (item.content ?? item.snippet ?? "").replace(/\s+/g, " ").trim()
    }))
    .filter((item) => item.title && item.url)
    .slice(0, 4);
}

async function searchNewsWeb(config: DashboardConfig, query: string): Promise<WebSearchResult[]> {
  const url = searchUrl(config, query);

  if (!url) {
    return [];
  }

  url.searchParams.set("categories", "news");
  url.searchParams.set("time_range", "day");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Anya/0.1 LAN dashboard"
    },
    signal: AbortSignal.timeout(6000)
  });

  if (!response.ok) {
    throw new Error(`News search returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; snippet?: string }>;
  };

  return (payload.results ?? [])
    .map((item) => ({
      title: item.title?.trim() ?? "",
      url: item.url?.trim() ?? "",
      snippet: (item.content ?? item.snippet ?? "").replace(/\s+/g, " ").trim()
    }))
    .filter((item) => item.title && item.url)
    .slice(0, 4);
}

async function fetchBuiltInNewsFeeds(feeds: NewsFeedSource[]): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const response = await fetch(feed.url, {
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "User-Agent": "Anya News Reader"
        },
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        throw new Error(`${feed.name} returned ${response.status}`);
      }

      const xml = await response.text();
      const parsed = await newsParser.parseString(xml);

      return parsed.items.slice(0, 8).map((item) => ({
        feed: feed.name,
        title: item.title ?? "Untitled",
        link: item.link ?? feed.url,
        date: item.isoDate ?? item.pubDate ?? null
      }));
    })
  );

  return results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((item) => item.title)
    .sort((first, second) => Date.parse(second.date ?? "") - Date.parse(first.date ?? ""));
}

async function rssNewsAnswer(config: DashboardConfig, question: string): Promise<AgentQuickResult | null> {
  const feedNames = preferredFeedNames(question);
  const feeds = config.rssFeeds.filter((feed) => {
    if (!feedNames.length) {
      return true;
    }

    const haystack = `${feed.name} ${feed.url}`.toLowerCase();
    return feedNames.some((name) => haystack.includes(name));
  });
  const builtIns = builtInFeedsForQuestion(question).filter(
    (builtIn) =>
      !feeds.some(
        (feed) => comparableFeedUrl(feed.url) === comparableFeedUrl(builtIn.url) || feed.name.toLowerCase() === builtIn.name.toLowerCase()
      )
  );

  if (!feeds.length && !builtIns.length) {
    return null;
  }

  const configuredItemsPromise: Promise<NewsItem[]> = feeds.length
    ? Promise.race([
        fetchRssFeeds(feeds).then((results) => results.flatMap((feed) => feed.items.map((item) => ({ ...item, feed: feed.feed })))),
        new Promise<NewsItem[]>((resolve) => setTimeout(() => resolve([]), 2500))
      ])
    : Promise.resolve([]);
  const builtInItemsPromise = builtIns.length ? fetchBuiltInNewsFeeds(builtIns) : Promise.resolve([]);
  const [configuredItems, builtInItems] = await Promise.all([configuredItemsPromise, builtInItemsPromise]);
  const seenTitles = new Set<string>();
  const items = [...configuredItems, ...builtInItems]
    .filter((item) => {
      const title = comparableTitle(item.title ?? "");

      if (!title || seenTitles.has(title)) {
        return false;
      }

      seenTitles.add(title);
      return true;
    })
    .sort((first, second) => Date.parse(second.date ?? "") - Date.parse(first.date ?? ""))
    .slice(0, 5);

  if (!items.length) {
    return null;
  }

  const sourceNames = [...new Set([...feeds.map((feed) => feed.name), ...builtIns.map((feed) => feed.name)])];
  const sourceLabel = feedNames.length ? sourceNames.join(", ") : "RSS";
  const lines = items.slice(0, 4).map((item, index) => `${index + 1}. ${item.feed}: ${item.title}`);

  return {
    response: [`Viimeisimmät uutiset lähteestä ${sourceLabel}:`, ...lines].join("\n"),
    sources: ["rss"],
    checkedAt: new Date().toISOString()
  };
}

async function answerNews(config: DashboardConfig, question: string): Promise<AgentQuickResult> {
  const query = cleanNewsQuery(question);
  const preferredFeeds = preferredFeedNames(question);
  const expectsNamedNewsSource = preferredFeeds.length > 0;
  const rssAttempt = await Promise.race([
    rssNewsAnswer(config, question),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), expectsNamedNewsSource ? 5000 : 1800))
  ]);

  if (rssAttempt) {
    return rssAttempt;
  }

  if (expectsNamedNewsSource) {
    return {
      response: `En saanut haettua ${query}-uutisia RSS-lähteestä juuri nyt. Kokeile hetken päästä uudelleen.`,
      sources: ["rss"],
      checkedAt: new Date().toISOString()
    };
  }

  return {
    response: webAnswer(query, await searchNewsWeb(config, query)),
    sources: ["web"],
    checkedAt: new Date().toISOString()
  };
}

function webAnswer(query: string, results: WebSearchResult[]) {
  if (!results.length) {
    return "En saanut web-hausta tuloksia. Tarkista SearXNG-asetukset tai kokeile tarkempaa hakua.";
  }

  const lines = results.slice(0, 3).map((item, index) => {
    const snippet = item.snippet ? ` ${item.snippet.slice(0, 180)}` : "";
    return `${index + 1}. ${item.title}.${snippet}`;
  });

  return [`Hain verkosta: ${query}.`, ...lines].join("\n");
}

function naturalWebAnswer(query: string, results: WebSearchResult[]) {
  if (!results.length) {
    return "En saanut verkosta kunnollista tulosta tähän juuri nyt.";
  }

  const best = results[0];
  const snippet = best.snippet ? best.snippet.slice(0, 260) : "";
  const normalizedQuery = normalizedQuestion(query);
  const lowerTitle = best.title.toLowerCase();
  const isRecommendation = /(kannattaako|suositteletko|katsoa|katsomisen arvoinen|onko se hyva|onko hyva)/.test(normalizedQuery);
  const isReview = isRecommendation || /arvostel|review|imdb|rottentomatoes|letterboxd|film-o-holic|episodi|leffatykki/.test(`${query} ${lowerTitle}`);

  if (isReview) {
    const lowerSnippet = snippet.toLowerCase();
    const clearlyPositive = /(erinomainen|loistava|hyvä|onnistunut|viihdyttävä|suositeltava|vahva|tiukasti toteutettu|tunnetuin|mahtava|klassikko|ansainnut|lämpimästi|yllättävänkin vauhdikkaasti|hyvä niin|kipittää|vuokraamoon)/.test(lowerSnippet);
    const clearlyNegative = /(huono|heikko|kehno|tylsä|epäonnistunut|lattea|sekava|unohda|pettymys)/.test(lowerSnippet);
    const verdict = clearlyPositive
      ? (isRecommendation ? "Hakutuloksen perusteella kyllä, se vaikuttaa katsomisen arvoiselta." : "Vaikuttaa arvostelun perusteella myönteiseltä.")
      : clearlyNegative
        ? (isRecommendation ? "Hakutuloksen perusteella suhtautuisin varauksella." : "Vaikuttaa arvostelun perusteella kriittiseltä.")
        : (isRecommendation ? "En antaisi varmaa suositusta pelkän hakutuloksen perusteella." : "En näe hakutuloksesta selvää arvosanaa tai tuomiota.");

    return snippet
      ? `${verdict} Löysin lähteen: ${best.title}. Hakutuloksen tiivistelmä: ${snippet}`
      : `Löysin arvostelun: ${best.title}, mutta hakutulos ei antanut selkeää tiivistelmää tai arviota.`;
  }

  const other = results[1]?.title ? ` Toinen osuma oli ${results[1].title}.` : "";

  return snippet ? `Löysin tästä: ${best.title}. ${snippet}${other}` : `Löysin tästä: ${best.title}.${other}`;
}

function cleanSnippet(snippet: string) {
  return snippet
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wikipediaSearchSnippetAnswer(query: string, results: WebSearchResult[], wantsPlot: boolean) {
  const wikipediaResult = results.find((result) => /wikipedia/i.test(`${result.title} ${result.url}`));

  if (!wikipediaResult?.snippet) {
    return naturalWebAnswer(`${query} wikipedia`, results);
  }

  const title = wikipediaResult.title.replace(/\s*[-–]\s*Wikipedia.*$/i, "").trim();
  const snippet = clipSentence(cleanSnippet(wikipediaResult.snippet), wantsPlot ? 780 : 600);

  return wantsPlot
    ? `${title}, kuvaus Wikipedian hakutuloksen mukaan: ${snippet}`
    : `${title}, Wikipedian hakutuloksen mukaan: ${snippet}`;
}

function titleFromWikipediaUrl(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/wiki\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function titleFromWikipediaSearchTitle(title: string) {
  if (!/wikipedia/i.test(title)) {
    return null;
  }

  return title
    .replace(/\s*[-–]\s*Wikipedia.*$/i, "")
    .replace(/\s+/g, "_")
    .trim() || null;
}

function wikipediaApiTitleFromResults(results: WebSearchResult[]) {
  for (const result of results) {
    const title = titleFromWikipediaUrl(result.url) ?? titleFromWikipediaSearchTitle(result.title);

    if (title) {
      return title;
    }
  }

  return null;
}

async function wikipediaSummary(title: string) {
  const url = new URL(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Anya/0.1 LAN dashboard"
    },
    signal: AbortSignal.timeout(6000)
  });

  if (!response.ok) {
    throw new Error(`Wikipedia returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    title?: string;
    extract?: string;
    description?: string;
    content_urls?: { desktop?: { page?: string } };
  };

  if (!payload.extract) {
    return null;
  }

  return {
    title: payload.title ?? title,
    description: payload.description,
    extract: payload.extract.replace(/\s+/g, " ").trim(),
    url: payload.content_urls?.desktop?.page
  };
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<sup[\s\S]*?<\/sup>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\[\s*edit\s*\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clipSentence(text: string, maxLength = 650) {
  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, maxLength);
  const lastSentence = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("! "), clipped.lastIndexOf("? "));

  return `${clipped.slice(0, lastSentence > 240 ? lastSentence + 1 : maxLength).trim()}...`;
}

async function wikipediaPlot(title: string) {
  const sectionsUrl = new URL("https://en.wikipedia.org/w/api.php");
  sectionsUrl.searchParams.set("action", "parse");
  sectionsUrl.searchParams.set("page", title);
  sectionsUrl.searchParams.set("prop", "sections");
  sectionsUrl.searchParams.set("format", "json");
  sectionsUrl.searchParams.set("origin", "*");

  const sectionsResponse = await fetch(sectionsUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Anya/0.1 LAN dashboard"
    },
    signal: AbortSignal.timeout(6000)
  });

  if (!sectionsResponse.ok) {
    throw new Error(`Wikipedia sections returned ${sectionsResponse.status}`);
  }

  const sectionsPayload = (await sectionsResponse.json()) as {
    parse?: { sections?: Array<{ index?: string; line?: string }> };
  };
  const section = sectionsPayload.parse?.sections?.find((item) => /^(plot|synopsis|premise)$/i.test(item.line ?? ""));

  if (!section?.index) {
    return null;
  }

  const textUrl = new URL("https://en.wikipedia.org/w/api.php");
  textUrl.searchParams.set("action", "parse");
  textUrl.searchParams.set("page", title);
  textUrl.searchParams.set("prop", "text");
  textUrl.searchParams.set("section", section.index);
  textUrl.searchParams.set("format", "json");
  textUrl.searchParams.set("origin", "*");

  const textResponse = await fetch(textUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Anya/0.1 LAN dashboard"
    },
    signal: AbortSignal.timeout(6000)
  });

  if (!textResponse.ok) {
    throw new Error(`Wikipedia section returned ${textResponse.status}`);
  }

  const textPayload = (await textResponse.json()) as {
    parse?: { title?: string; text?: { "*"?: string } };
  };
  const text = stripHtml(textPayload.parse?.text?.["*"] ?? "");

  return text ? { title: textPayload.parse?.title ?? title, text } : null;
}

function likelyWikipediaSearchQuery(question: string, memory?: AgentMemory) {
  const raw = memory?.lastSubject && !/\b(hae|etsi|wikipedia|wikipediasta|plot|juoni)\b/i.test(question)
    ? `${memory.lastSubject} ${question}`
    : cleanSearchQuery(question) || question;

  return raw
    .replace(/\b(wikipedia|wikipediasta)\b/gi, "")
    .replace(/\b(plot|juoni)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function answerWikipediaSummary(config: DashboardConfig, question: string, memory?: AgentMemory): Promise<AgentQuickResult> {
  const query = likelyWikipediaSearchQuery(question, memory);
  const results = await searchWeb(config, `${query} wikipedia`);
  const title = wikipediaApiTitleFromResults(results);
  const checkedAt = new Date().toISOString();
  const wantsPlot = /(plot|juoni)/.test(normalizedQuestion(question));

  if (title) {
    try {
      if (wantsPlot) {
        const plot = await wikipediaPlot(title);

        if (plot) {
          return {
            response: `${plot.title}, juoni: ${clipSentence(plot.text)}`,
            sources: ["web", "wikipedia"],
            checkedAt
          };
        }
      }

      const summary = await wikipediaSummary(title);

      if (summary) {
        return {
          response: `${summary.title}: ${clipSentence(summary.extract)}`,
          sources: ["web", "wikipedia"],
          checkedAt
        };
      }
    } catch {
      // Fall back to search snippets below.
    }
  }

  return {
    response: wikipediaSearchSnippetAnswer(query, results, wantsPlot),
    sources: ["web"],
    checkedAt
  };
}

async function latestPlexAnswer(config: DashboardConfig, question: string, sessionId?: string, requestedIndex?: number): Promise<AgentQuickResult> {
  const plex = await getPlexWidgetData(config);
  const checkedAt = new Date().toISOString();
  const index = requestedIndex ?? plexRecentIndex(question);

  if (!plex.configured) {
    return {
      response: "Plex ei ole vielä konfiguroitu Anyassa.",
      sources: ["plex"],
      checkedAt
    };
  }

  if (plex.status !== "online") {
    return {
      response: `Plex ei näytä olevan online. ${plex.error ?? "Viimeisintä lisäystä ei voi tarkistaa juuri nyt."}`,
      sources: ["plex"],
      checkedAt
    };
  }

  const latest = plex.recentlyAdded[index]?.title;
  const year = plex.recentlyAdded[index]?.year;

  if (latest) {
    await remember(sessionId, {
      lastSubject: latest,
      lastSearchSubject: year ? `${latest} ${year}` : latest,
      lastSubjectKind: "plex-item",
      lastTool: "plex.latest"
    });
  }

  return {
    response: latest
      ? `${plexRecentLabel(index)} Plexiin lisätty on ${latest}.`
      : `Plexissä ei näy ${plexRecentLabel(index).toLowerCase()} lisättyä kohdetta.`,
    sources: ["plex"],
    checkedAt
  };
}

export async function runAnyaAgentQuick(config: DashboardConfig, question: string, sessionId?: string): Promise<AgentQuickResult | null> {
  const normalized = normalizedQuestion(question);
  const checkedAt = new Date().toISOString();
  const memory = await recall(sessionId);
  const intent = classifyIntent(question, memory);

  if (intent.type === "plex-recent") {
    return latestPlexAnswer(config, question, sessionId, intent.index);
  }

  if (intent.type === "news") {
    const query = cleanSearchQuery(question) || question;
    const rssAnswer = await cachedDirectAnswer(`news:${query}`, () => answerNews(config, question), 6500, 60_000);
    await remember(sessionId, { lastSubject: cleanNewsQuery(question), lastSearchSubject: cleanNewsQuery(question), lastSubjectKind: "news-query", lastTool: "news.search" });
    return rssAnswer;
  }

  if (intent.type === "wikipedia-summary") {
    const answer = await cachedDirectAnswer(
      `wiki:${likelyWikipediaSearchQuery(question, memory)}`,
      () => answerWikipediaSummary(config, question, memory),
      8000,
      60_000
    );
    await remember(sessionId, { lastSubject: likelyWikipediaSearchQuery(question, memory), lastSearchSubject: likelyWikipediaSearchQuery(question, memory), lastSubjectKind: "web-query", lastTool: "web.wikipedia" });
    return answer;
  }

  if (intent.type === "web-followup") {
    const followupIntent = /(kannattaako|suositteletko|katsoa|katsomisen arvoinen)/.test(normalized)
      ? `${question} arvostelu review`
      : /(onko se hyva|onko hyva|arvostel|review)/.test(normalized)
        ? "arvostelu review"
        : question;
    const query = `${memory?.lastSearchSubject ?? memory?.lastSubject} ${followupIntent}`;
    const results = await cachedDirectAnswer(`web:${query}`, async () => ({
      response: naturalWebAnswer(query, await searchWeb(config, query)),
      sources: ["web"],
      checkedAt: new Date().toISOString()
    }), 7000, 60_000);
    await remember(sessionId, {
      lastSubject: memory?.lastSubject,
      lastSearchSubject: memory?.lastSearchSubject,
      lastSubjectKind: memory?.lastSubjectKind,
      lastTool: "web.followup"
    });
    return results;
  }

  if (intent.type === "web-search") {
    const query = memory?.lastSubject && !/hae|etsi|google|web|netist|searx/i.test(question)
      ? `${memory.lastSearchSubject ?? memory.lastSubject} ${question}`
      : cleanSearchQuery(question) || question;
    const results = await cachedDirectAnswer(`web:${query}`, async () => ({
      response: webAnswer(query, await searchWeb(config, query)),
      sources: ["web"],
      checkedAt: new Date().toISOString()
    }), 7000, 60_000);
    await remember(sessionId, { lastSubject: query, lastSearchSubject: query, lastSubjectKind: "web-query", lastTool: "web.search" });
    return results;
  }

  if (intent.type === "vpn") {
    return cachedDirectAnswer("vpn", async () => {
      const vpn = await getGluetunWidgetData(config);
      const location = [vpn.city, vpn.country].filter(Boolean).join(", ");

      if (vpn.leakDetected || vpn.protected === false) {
        return {
          response: `VPN ei näytä turvalliselta. ${vpn.error ?? "Suojaus ei ole päällä."}`,
          sources: ["vpn"],
          checkedAt
        };
      }

      if (vpn.status === "online" && vpn.protected) {
        return {
          response: `VPN on kunnossa. Reitti on suojattu${vpn.vpnIp ? ` IP:n ${vpn.vpnIp} kautta` : ""}${location ? ` (${location})` : ""}.`,
          sources: ["vpn"],
          checkedAt
        };
      }

      return {
        response: `VPN tila on ${vpn.status}. ${vpn.error ?? "Lisätietoa ei ole saatavilla."}`,
        sources: ["vpn"],
        checkedAt
      };
    });
  }

  if (intent.type === "unifi") {
    const unifi = await getUnifiWidgetData(config);
    return {
      response: `UniFi: ${unifi.status}, ${unifi.clients ?? 0} clienttiä, ${unifi.accessPoints ?? 0} access pointtia, ${unifi.cameras ?? 0} kameraa, latency ${unifi.latencyMs ?? "-"} ms.`,
      sources: ["unifi"],
      checkedAt
    };
  }

  if (intent.type === "docker") {
    const docker = await getDockerWidgetData(config);
    const stopped = docker.stoppedContainers?.length
      ? docker.stoppedContainers.slice(0, 5).map((item) => `${item.name}${item.status ? ` (${item.status})` : ""}`).join(", ")
      : "ei pysähtyneitä kontteja listattuna";

    return {
      response: `Docker: ${docker.running ?? 0} käynnissä, ${docker.stopped ?? 0} pysähtynyt. Pysähtyneet: ${stopped}.`,
      sources: ["docker"],
      checkedAt
    };
  }

  if (intent.type === "qbittorrent") {
    const qbit = await getQBittorrentWidgetData(config);
    return {
      response: `qBittorrent: ${qbit.status}, ${qbit.total ?? 0} torrenttia. Nopeus ${qbit.downloadMbps ?? 0}/${qbit.uploadMbps ?? 0} Mbps. Lataamassa ${qbit.downloading ?? 0}, seedaamassa ${qbit.seeding ?? 0}.`,
      sources: ["qbittorrent"],
      checkedAt
    };
  }

  if (intent.type === "plex-status") {
    const plex = await getPlexWidgetData(config);
    const latest = plex.recentlyAdded[0]?.title;

    if (latest) {
      const year = plex.recentlyAdded[0]?.year;
      await remember(sessionId, {
        lastSubject: latest,
        lastSearchSubject: year ? `${latest} ${year}` : latest,
        lastSubjectKind: "plex-item",
        lastTool: "plex"
      });
    }

    return {
      response: latest
        ? `Plex on ${plex.status}. Viimeksi lisätty on ${latest}.`
        : `Plex on ${plex.status}, mutta viimeisimpiä lisäyksiä ei näy.`,
      sources: ["plex"],
      checkedAt
    };
  }

  return null;
}
