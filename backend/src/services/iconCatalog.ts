import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IconCatalog, IconCatalogItem, ServiceTemplate } from "../types.js";
import { getConfigDirectory, loadServiceTemplates } from "./config.js";

interface GitTreeResponse {
  tree?: Array<{ path?: string; type?: string }>;
}

const sources = [
  {
    id: "selfhst" as const,
    label: "selfh.st/icons",
    treeUrl: "https://api.github.com/repos/selfhst/icons/git/trees/main?recursive=1",
    cdnBase: "https://cdn.jsdelivr.net/gh/selfhst/icons"
  },
  {
    id: "dashboard-icons" as const,
    label: "Dashboard Icons",
    treeUrl: "https://api.github.com/repos/homarr-labs/dashboard-icons/git/trees/main?recursive=1",
    cdnBase: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons"
  }
];

const preferredNames = new Map<string, string>([
  ["home-assistant", "Home Assistant"],
  ["nginx-proxy-manager", "Nginx Proxy Manager"],
  ["open-webui", "Open WebUI"],
  ["qbittorrent", "qBittorrent"],
  ["unifi", "UniFi"],
  ["proxmox", "Proxmox"],
  ["portainer", "Portainer"],
  ["searxng", "SearXNG"],
  ["jellyfin", "Jellyfin"],
  ["sonarr", "Sonarr"],
  ["radarr", "Radarr"],
  ["plex", "Plex"]
]);

function getCatalogPath() {
  return path.join(getConfigDirectory(), "icon-catalog.json");
}

export function normalizeIconKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\.(svg|png)$/i, "")
    .replace(/-(dark|light)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nameFromSlug(slug: string) {
  return preferredNames.get(slug) ?? slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function scorePath(pathname: string) {
  const isSvg = pathname.startsWith("svg/") && pathname.endsWith(".svg");
  const isPlain = !/-(dark|light)\.(svg|png)$/i.test(pathname);
  return (isSvg ? 10 : 0) + (isPlain ? 5 : 0);
}

async function fetchSource(source: (typeof sources)[number]): Promise<IconCatalogItem[]> {
  const response = await fetch(source.treeUrl, {
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": "Anya"
    }
  });

  if (!response.ok) {
    throw new Error(`${source.label} returned ${response.status}`);
  }

  const payload = (await response.json()) as GitTreeResponse;
  const candidates = (payload.tree ?? [])
    .filter((item) => item.type === "blob" && item.path && /^(svg|png)\/.+\.(svg|png)$/i.test(item.path))
    .map((item) => item.path as string);

  const bestBySlug = new Map<string, string>();
  for (const itemPath of candidates) {
    const fileName = itemPath.split("/").pop() ?? itemPath;
    const slug = normalizeIconKey(fileName);
    const current = bestBySlug.get(slug);

    if (!current || scorePath(itemPath) > scorePath(current)) {
      bestBySlug.set(slug, itemPath);
    }
  }

  return Array.from(bestBySlug.entries()).map(([slug, itemPath]) => ({
    id: `${source.id}:${slug}`,
    name: nameFromSlug(slug),
    slug,
    source: source.id,
    iconUrl: `${source.cdnBase}/${itemPath}`,
    aliases: [slug, slug.replace(/-/g, " ")]
  }));
}

function templateCatalogItems(templates: ServiceTemplate[]): IconCatalogItem[] {
  return templates.flatMap((template) => {
    if (!template.iconUrl) {
      return [];
    }

    return [
      {
        id: `template:${template.id}`,
        name: template.name,
        slug: template.id,
        source: "template",
        iconUrl: template.iconUrl,
        aliases: [template.name, template.id, ...(template.aliases ?? [])]
      }
    ];
  });
}

function dedupeItems(items: IconCatalogItem[]) {
  const bySlug = new Map<string, IconCatalogItem>();

  for (const item of items) {
    if (!bySlug.has(item.slug)) {
      bySlug.set(item.slug, item);
    }
  }

  return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadIconCatalog(): Promise<IconCatalog> {
  try {
    const raw = await readFile(getCatalogPath(), "utf-8");
    const parsed = JSON.parse(raw) as IconCatalog;

    if (!Array.isArray(parsed.items)) {
      throw new Error("Invalid icon catalog");
    }

    return parsed;
  } catch {
    const templates = await loadServiceTemplates();
    return {
      updatedAt: null,
      items: templateCatalogItems(templates)
    };
  }
}

export async function refreshIconCatalog(): Promise<IconCatalog> {
  const templates = await loadServiceTemplates();
  const results = await Promise.allSettled(sources.map(fetchSource));
  const items = dedupeItems([
    ...templateCatalogItems(templates),
    ...results.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
  ]);
  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => (result.reason instanceof Error ? result.reason.message : "Icon source failed"));
  const catalog: IconCatalog = {
    updatedAt: new Date().toISOString(),
    items,
    error: errors.length ? errors.join("; ") : undefined
  };

  await writeFile(getCatalogPath(), `${JSON.stringify(catalog, null, 2)}\n`, "utf-8");
  return catalog;
}

export function findIconForService(items: IconCatalogItem[], name: string, url?: string) {
  const host = (() => {
    try {
      return url ? new URL(url).hostname : "";
    } catch {
      return "";
    }
  })();
  const candidates = [
    normalizeIconKey(name),
    normalizeIconKey(host.replace(/^www\./, "").split(".")[0] ?? ""),
    ...normalizeIconKey(name).split("-").filter((part) => part.length > 2)
  ].filter(Boolean);

  return items.find((item) => {
    const aliases = [item.slug, item.name, ...(item.aliases ?? [])].map(normalizeIconKey);
    return candidates.some((candidate) => aliases.includes(candidate));
  });
}
