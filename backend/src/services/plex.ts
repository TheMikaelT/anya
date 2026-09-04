import { parseStringPromise } from "xml2js";
import type { DashboardConfig } from "../types.js";
import { loadSecretSettings } from "./secrets.js";

interface PlexXmlNode {
  $?: Record<string, string>;
  Directory?: PlexXmlNode[];
  Metadata?: PlexXmlNode[];
  Video?: PlexXmlNode[];
  Track?: PlexXmlNode[];
  Album?: PlexXmlNode[];
  Player?: PlexXmlNode[];
}

interface PlexXmlResponse {
  MediaContainer?: PlexXmlNode;
}

export interface PlexWidgetData {
  status: "online" | "offline" | "unknown";
  configured: boolean;
  activeStreams: number;
  libraries: number;
  mediaLabel: string;
  movies: number;
  shows: number;
  recentlyAdded: PlexRecentlyAdded[];
  recentActivity: Array<{
    title: string;
    status: "playing" | "paused";
    client: string;
  }>;
  settings: {
    showRecentlyAdded: boolean;
  };
  error?: string;
}

export interface PlexRecentlyAdded {
  title: string;
  year?: string;
  posterUrl?: string;
}

function emptyPlexData(error: string, configured = false): PlexWidgetData {
  return {
    status: configured ? "offline" : "unknown",
    configured,
    activeStreams: 0,
    libraries: 0,
    mediaLabel: "-",
    movies: 0,
    shows: 0,
    recentlyAdded: [],
    recentActivity: [],
    settings: {
      showRecentlyAdded: true
    },
    error
  };
}

function appendPath(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

async function requestPlexXml(baseUrl: string, token: string, path: string): Promise<PlexXmlNode> {
  const url = new URL(appendPath(baseUrl, path));
  url.searchParams.set("X-Plex-Token", token);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/xml"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Plex API returned ${response.status}`);
    }

    const xml = await response.text();
    const parsed = (await parseStringPromise(xml, { explicitArray: true })) as PlexXmlResponse;
    return parsed.MediaContainer ?? {};
  } finally {
    clearTimeout(timeout);
  }
}

async function requestPlexXmlAllowSelfSigned(baseUrl: string, token: string, path: string): Promise<PlexXmlNode> {
  if (!baseUrl.startsWith("https://")) {
    return requestPlexXml(baseUrl, token, path);
  }

  const previousReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  try {
    return await requestPlexXml(baseUrl, token, path);
  } finally {
    if (previousReject === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousReject;
    }
  }
}

function attr(node: PlexXmlNode | undefined, key: string) {
  return node?.$?.[key] ?? "";
}

function titleOf(node: PlexXmlNode) {
  return attr(node, "grandparentTitle") || attr(node, "parentTitle") || attr(node, "title") || "Unknown";
}

function posterPathOf(node: PlexXmlNode) {
  return attr(node, "thumb") || attr(node, "parentThumb") || attr(node, "grandparentThumb") || "";
}

function playerOf(node: PlexXmlNode) {
  return node.Player?.[0];
}

function mediaItemsOf(node: PlexXmlNode) {
  return [
    ...(node.Metadata ?? []),
    ...(node.Video ?? []),
    ...(node.Directory ?? []),
    ...(node.Track ?? []),
    ...(node.Album ?? [])
  ];
}

async function countSection(baseUrl: string, token: string, key: string) {
  const section = await requestPlexXmlAllowSelfSigned(
    baseUrl,
    token,
    `/library/sections/${encodeURIComponent(key)}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=0`
  );

  return Number(attr(section, "totalSize") || attr(section, "size") || 0);
}

async function recentlyAddedForSection(baseUrl: string, token: string, key: string) {
  const recent = await requestPlexXmlAllowSelfSigned(
    baseUrl,
    token,
    `/library/sections/${encodeURIComponent(key)}/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size=6`
  );

  return mediaItemsOf(recent);
}

function plexImageUrl(path: string) {
  return `/api/plex/image?path=${encodeURIComponent(path)}`;
}

async function fetchPlexImage(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "image/*"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Plex image returned ${response.status}`);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestPlexImage(config: DashboardConfig, imagePath: string): Promise<{
  body: Buffer;
  contentType: string;
  cacheControl: string;
}> {
  const baseUrl = config.integrations?.plex?.baseUrl?.trim();
  const secrets = await loadSecretSettings();
  const token = secrets.plex?.token?.trim();

  if (!baseUrl || !token) {
    throw new Error("Plex is not configured");
  }

  if (!imagePath.startsWith("/")) {
    throw new Error("Invalid Plex image path");
  }

  const directUrl = new URL(appendPath(baseUrl, imagePath));
  directUrl.searchParams.set("X-Plex-Token", token);
  const transcodeUrl = new URL(appendPath(baseUrl, "/photo/:/transcode"));
  transcodeUrl.searchParams.set("url", imagePath);
  transcodeUrl.searchParams.set("width", "360");
  transcodeUrl.searchParams.set("height", "540");
  transcodeUrl.searchParams.set("minSize", "1");
  transcodeUrl.searchParams.set("upscale", "1");
  transcodeUrl.searchParams.set("X-Plex-Token", token);
  const previousReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  if (baseUrl.startsWith("https://")) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  try {
    const response = await fetchPlexImage(directUrl).catch(() => fetchPlexImage(transcodeUrl));

    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "image/jpeg",
      cacheControl: "private, max-age=300"
    };
  } finally {
    if (baseUrl.startsWith("https://")) {
      if (previousReject === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousReject;
      }
    }
  }
}

export async function getPlexWidgetData(config: DashboardConfig): Promise<PlexWidgetData> {
  const baseUrl = config.integrations?.plex?.baseUrl?.trim();
  const showRecentlyAdded = config.integrations?.plex?.showRecentlyAdded ?? true;
  const secrets = await loadSecretSettings();
  const token = secrets.plex?.token?.trim();

  if (!baseUrl || !token) {
    return {
      ...emptyPlexData("Configure Plex in Manage -> Integrations."),
      settings: { showRecentlyAdded }
    };
  }

  try {
    const [sessions, sections] = await Promise.all([
      requestPlexXmlAllowSelfSigned(baseUrl, token, "/status/sessions"),
      requestPlexXmlAllowSelfSigned(baseUrl, token, "/library/sections")
    ]);

    const directories = sections.Directory ?? [];
    const movieSections = directories.filter((item) => attr(item, "type") === "movie");
    const showSections = directories.filter((item) => attr(item, "type") === "show");
    const [movies, shows] = await Promise.all([
      Promise.all(movieSections.map((section) => countSection(baseUrl, token, attr(section, "key")))).then((counts) =>
        counts.reduce((sum, count) => sum + count, 0)
      ),
      Promise.all(showSections.map((section) => countSection(baseUrl, token, attr(section, "key")))).then((counts) =>
        counts.reduce((sum, count) => sum + count, 0)
      )
    ]);

    const recentItems = showRecentlyAdded
      ? (
          await Promise.all(
            directories.map((section) => recentlyAddedForSection(baseUrl, token, attr(section, "key")).catch(() => []))
          )
        )
          .flat()
          .sort((first, second) => Number(attr(second, "addedAt") || 0) - Number(attr(first, "addedAt") || 0))
      : [];
    const sessionItems = mediaItemsOf(sessions);

    return {
      status: "online",
      configured: true,
      activeStreams: Number(attr(sessions, "size") || sessionItems.length || 0),
      libraries: directories.length,
      mediaLabel: `${movies + shows} items`,
      movies,
      shows,
      recentlyAdded: recentItems
        .map((item) => ({
          title: titleOf(item),
          year: attr(item, "year") || undefined,
          posterUrl: posterPathOf(item) ? plexImageUrl(posterPathOf(item)) : undefined
        }))
        .filter((item) => item.title)
        .slice(0, 6),
      recentActivity: sessionItems.slice(0, 4).map((item) => ({
        title: titleOf(item),
        status: attr(playerOf(item), "state") === "paused" ? "paused" : "playing",
        client: attr(playerOf(item), "title") || attr(playerOf(item), "product") || "Plex client"
      })),
      settings: {
        showRecentlyAdded
      }
    };
  } catch (error) {
    return {
      ...emptyPlexData(error instanceof Error ? error.message : "Plex request failed", true),
      settings: { showRecentlyAdded }
    };
  }
}
