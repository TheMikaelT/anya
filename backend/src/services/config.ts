import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AdditionalIntegrationId,
  AdditionalIntegrationSettings,
  AppearanceSettings,
  DashboardConfig,
  DashboardLink,
  DashboardLinkInput,
  DockerSource,
  DockerSourceInput,
  IntegrationId,
  IntegrationSettingsInput,
  LinkLayout,
  RssFeedConfig,
  RssSettings,
  SearchSettings,
  SecretSettings,
  ServiceTemplate,
  WidgetFlags,
  WidgetId,
  WidgetLayout,
  WidgetStyle
} from "../types.js";
import { serviceDefinitions } from "./additionalIntegrations.js";
import { loadSecretSettings, saveSecretSettings } from "./secrets.js";

const defaultConfigPath = path.resolve(process.cwd(), "../config/dashboard.json");
const defaultTemplatesPath = path.resolve(process.cwd(), "../config/templates.json");
const coreWidgetOrder: WidgetId[] = ["today", "tasks", "mail", "unifi", "plex", "docker", "gluetun", "qbittorrent", "ollama", "assistant", "rss", "backup", "notes", "journal"];
const defaultWidgetOrder: WidgetId[] = [...coreWidgetOrder, ...serviceDefinitions.map((definition) => definition.id)];
const defaultWidgetLayout: WidgetLayout = "sidebar";
const defaultWidgetStyle: WidgetStyle = "cards";
const defaultLinkLayout: LinkLayout = "grouped";
const defaultSearch = {
  label: "Google",
  urlTemplate: "https://www.google.com/search?q={query}",
  visible: true
};
const defaultRssSettings: Required<RssSettings> = {
  radarTotalItems: 10,
  tickerTotalItems: 24,
  tickerSpeedSeconds: 72
};
const defaultAppearance: Required<AppearanceSettings> = {
  background: {
    mode: "default",
    preset: "aurora",
    imageUrl: undefined,
    dim: 45,
    blur: 0
  }
};
const defaultAppearanceDim = 45;
const defaultAppearanceBlur = 0;

function getConfigPath() {
  return process.env.CONFIG_PATH
    ? path.resolve(process.env.CONFIG_PATH)
    : defaultConfigPath;
}

function getTemplatesPath() {
  return process.env.TEMPLATES_PATH
    ? path.resolve(process.env.TEMPLATES_PATH)
    : defaultTemplatesPath;
}

export function getConfigDirectory() {
  return path.dirname(getConfigPath());
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLink(link: DashboardLink, index: number): DashboardLink {
  return {
    ...link,
    id: link.id || slugify(`${link.category}-${link.name}`) || `service-${index + 1}`,
    icon: link.icon || "server",
    iconUrl: trimOptional(link.iconUrl)
  };
}

function normalizeConfig(config: DashboardConfig): DashboardConfig {
  const usedIds = new Set<string>();
  const links = config.links.map((link, index) => {
    const normalized = normalizeLink(link, index);
    const baseId = normalized.id ?? `service-${index + 1}`;
    let id = baseId;
    let suffix = 2;

    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(id);
    return { ...normalized, id };
  });

  const widgetOrder = (config.widgetOrder ?? defaultWidgetOrder).filter(
    (widget): widget is WidgetId => defaultWidgetOrder.includes(widget as WidgetId)
  );
  const missingWidgets = defaultWidgetOrder.filter((widget) => !widgetOrder.includes(widget));
  const mobileWidgetOrder = (config.mobileWidgetOrder ?? config.widgetOrder ?? defaultWidgetOrder).filter(
    (widget): widget is WidgetId => defaultWidgetOrder.includes(widget as WidgetId)
  );
  const missingMobileWidgets = defaultWidgetOrder.filter((widget) => !mobileWidgetOrder.includes(widget));

  const widgetLayout = config.widgetLayout === "center" || config.widgetLayout === "rail" ? config.widgetLayout : defaultWidgetLayout;
  const widgetStyle = ["compact", "dense"].includes(config.widgetStyle ?? "") ? config.widgetStyle : defaultWidgetStyle;
  const linkLayout = config.linkLayout === "grid" ? "grid" : defaultLinkLayout;
  const rssSettings = cleanRssSettings(config.rssSettings);
  const rssFeeds = config.rssFeeds.map(cleanRssFeed);
  const widgets = { ...config.widgets };
  const integrations = config.integrations
    ? {
        ...config.integrations,
        additional: cleanAdditionalPublicIntegrations(config.integrations.additional)
      }
    : config.integrations;

  if ((widgets as WidgetFlags & { services?: boolean }).services) {
    for (const definition of serviceDefinitions) {
      if (config.integrations?.additional?.[definition.id]?.enabled && widgets[definition.id] === undefined) {
        widgets[definition.id] = true;
      }
    }
  }

  if (widgets.assistant === undefined && widgets.ollama) {
    widgets.assistant = true;
  }

  delete (widgets as WidgetFlags & { services?: boolean }).services;

  return {
    ...config,
    integrations,
    links,
    rssFeeds,
    widgets,
    widgetOrder: [...widgetOrder, ...missingWidgets],
    mobileWidgetOrder: [...mobileWidgetOrder, ...missingMobileWidgets],
    widgetLayout,
    widgetStyle,
    linkLayout,
    rssSettings,
    search: { ...defaultSearch, ...config.search },
    appearance: cleanAppearanceSettings(config.appearance)
  };
}

function cleanAdditionalPublicSettings(settings?: AdditionalIntegrationSettings): AdditionalIntegrationSettings | undefined {
  if (!settings) {
    return undefined;
  }

  return {
    baseUrl: trimOptional(settings.baseUrl),
    slug: trimOptional(settings.slug),
    enabled: settings.enabled === true,
    showMetrics: settings.showMetrics !== false,
    controlEntityIds: cleanControlEntityIds(settings.controlEntityIds)
  };
}

function cleanAdditionalPublicIntegrations(additional?: Partial<Record<AdditionalIntegrationId, AdditionalIntegrationSettings>>) {
  if (!additional) {
    return undefined;
  }

  return Object.fromEntries(
    serviceDefinitions
      .map((definition) => {
        const settings = cleanAdditionalPublicSettings(additional[definition.id]);
        return settings ? [definition.id, settings] : null;
      })
      .filter((entry): entry is [AdditionalIntegrationId, AdditionalIntegrationSettings] => Boolean(entry))
  ) as Partial<Record<AdditionalIntegrationId, AdditionalIntegrationSettings>>;
}

function cleanLinkInput(input: DashboardLinkInput): DashboardLink {
  const name = input.name?.trim();
  const url = input.url?.trim();
  const category = input.category?.trim();

  if (!name || !url || !category) {
    throw new Error("Service name, URL and category are required");
  }

  try {
    new URL(url);
  } catch {
    throw new Error("Service URL must be a valid absolute URL");
  }

  return {
    id: input.id,
    name,
    url,
    description: input.description?.trim() || "No description",
    category,
    icon: input.icon?.trim() || "server",
    iconUrl: trimOptional(input.iconUrl)
  };
}

function keyUrl(url: string) {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function cleanRssFeed(input: RssFeedConfig): RssFeedConfig {
  const name = input.name?.trim();
  const url = input.url?.trim();

  if (!name || !url) {
    throw new Error("RSS feed name and URL are required");
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new Error("RSS feed URL must be a valid http(s) URL");
  }

  return {
    name,
    url,
    radarLimit: clampInteger(input.radarLimit, 0, 20, 3),
    tickerLimit: clampInteger(input.tickerLimit, 0, 20, 2)
  };
}

function cleanRssSettings(input?: RssSettings): Required<RssSettings> {
  return {
    radarTotalItems: clampInteger(input?.radarTotalItems, 3, 50, defaultRssSettings.radarTotalItems),
    tickerTotalItems: clampInteger(input?.tickerTotalItems, 3, 80, defaultRssSettings.tickerTotalItems),
    tickerSpeedSeconds: clampInteger(input?.tickerSpeedSeconds, 35, 180, defaultRssSettings.tickerSpeedSeconds)
  };
}

function cleanAppearanceSettings(input?: AppearanceSettings): Required<AppearanceSettings> {
  const background = input?.background;
  const mode = background?.mode === "preset" || background?.mode === "custom" ? background.mode : "default";
  const preset = ["aurora", "ember", "midnight", "forest"].includes(background?.preset ?? "") ? background?.preset : defaultAppearance.background.preset;
  const imageUrl = trimOptional(background?.imageUrl);

  return {
    background: {
      mode: mode === "custom" && !imageUrl ? "default" : mode,
      preset,
      imageUrl: imageUrl?.startsWith("/api/uploads/backgrounds/") ? imageUrl : undefined,
      dim: clampInteger(background?.dim, 0, 90, defaultAppearance.background.dim ?? defaultAppearanceDim),
      blur: clampInteger(background?.blur, 0, 18, defaultAppearance.background.blur ?? defaultAppearanceBlur)
    }
  };
}

function cleanDockerSource(input: DockerSourceInput, index: number): DockerSource {
  const type = input.type === "http" ? "http" : "socket";
  const name = trimOptional(input.name) ?? (type === "http" ? "Remote Docker" : "Local Docker");
  const id = trimOptional(input.id) ?? slugify(`${name}-${index + 1}`) ?? `docker-${index + 1}`;

  if (type === "http") {
    const baseUrl = trimOptional(input.baseUrl);

    if (!baseUrl) {
      throw new Error("Docker HTTP source needs a base URL");
    }

    try {
      const parsed = new URL(baseUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("invalid protocol");
      }
    } catch {
      throw new Error("Docker HTTP source base URL must be a valid http(s) URL");
    }

    return {
      id,
      name,
      type,
      enabled: input.enabled !== false,
      baseUrl: baseUrl.replace(/\/+$/, "")
    };
  }

  return {
    id,
    name,
    type,
    enabled: input.enabled !== false,
    socketPath: trimOptional(input.socketPath) ?? "/var/run/docker.sock"
  };
}

function cleanDockerSources(inputs: DockerSourceInput[]) {
  const usedIds = new Set<string>();

  return inputs.map((source, index) => {
    const cleaned = cleanDockerSource(source, index);
    const baseId = cleaned.id;
    let id = baseId;
    let suffix = 2;

    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(id);
    return { ...cleaned, id };
  });
}

export async function loadDashboardConfig(): Promise<DashboardConfig> {
  let raw: string;

  try {
    raw = await readFile(getConfigPath(), "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    raw = await readFile(path.join(getConfigDirectory(), "dashboard.example.json"), "utf-8");
  }

  const parsed = JSON.parse(raw) as DashboardConfig;

  if (!parsed.title || !Array.isArray(parsed.links) || !Array.isArray(parsed.rssFeeds)) {
    throw new Error("Invalid dashboard config: expected title, links and rssFeeds");
  }

  return normalizeConfig(parsed);
}

export async function saveDashboardConfig(config: DashboardConfig): Promise<DashboardConfig> {
  const normalized = normalizeConfig(config);
  const configPath = getConfigPath();
  const tempPath = `${configPath}.${randomUUID()}.tmp`;
  const payload = `${JSON.stringify(normalized, null, 2)}\n`;

  await writeFile(tempPath, payload, "utf-8");
  await rename(tempPath, configPath);

  return normalized;
}

export function linksResponse(config: DashboardConfig) {
  return {
    title: config.title,
    links: config.links,
    widgets: config.widgets,
    widgetOrder: config.widgetOrder,
    mobileWidgetOrder: config.mobileWidgetOrder,
    widgetLayout: config.widgetLayout,
    widgetStyle: config.widgetStyle,
    linkLayout: config.linkLayout,
    search: config.search,
    rssSettings: config.rssSettings,
    appearance: config.appearance
  };
}

export async function createDashboardLink(input: DashboardLinkInput): Promise<DashboardConfig> {
  const config = await loadDashboardConfig();
  const link = cleanLinkInput(input);
  const idBase = slugify(`${link.category}-${link.name}`) || randomUUID();
  const existingIds = new Set(config.links.map((item) => item.id));
  let id = idBase;
  let suffix = 2;

  while (existingIds.has(id)) {
    id = `${idBase}-${suffix}`;
    suffix += 1;
  }

  return saveDashboardConfig({
    ...config,
    links: [...config.links, { ...link, id }]
  });
}

export async function updateDashboardLink(id: string, input: DashboardLinkInput): Promise<DashboardConfig> {
  const config = await loadDashboardConfig();
  const index = config.links.findIndex((link) => link.id === id);

  if (index === -1) {
    throw new Error("Service not found");
  }

  const nextLinks = [...config.links];
  nextLinks[index] = { ...cleanLinkInput(input), id };

  return saveDashboardConfig({ ...config, links: nextLinks });
}

export async function updateRssFeeds(inputs: RssFeedConfig[], settings?: RssSettings): Promise<DashboardConfig> {
  const config = await loadDashboardConfig();
  const seenUrls = new Set<string>();
  const rssFeeds = inputs.map(cleanRssFeed).filter((feed) => {
    const urlKey = keyUrl(feed.url);

    if (seenUrls.has(urlKey)) {
      return false;
    }

    seenUrls.add(urlKey);
    return true;
  });

  return saveDashboardConfig({ ...config, rssFeeds, rssSettings: cleanRssSettings(settings ?? config.rssSettings), widgets: { ...config.widgets, rss: true } });
}

export async function deleteDashboardLink(id: string): Promise<DashboardConfig> {
  const config = await loadDashboardConfig();
  const nextLinks = config.links.filter((link) => link.id !== id);

  if (nextLinks.length === config.links.length) {
    throw new Error("Service not found");
  }

  return saveDashboardConfig({ ...config, links: nextLinks });
}

export async function updateLinkOrder(ids: string[]): Promise<DashboardConfig> {
  const config = await loadDashboardConfig();
  const idSet = new Set(ids);
  const orderedLinks = ids
    .map((id) => config.links.find((link) => link.id === id))
    .filter((link): link is DashboardLink => Boolean(link));
  const missingLinks = config.links.filter((link) => !idSet.has(link.id ?? ""));

  return saveDashboardConfig({ ...config, links: [...orderedLinks, ...missingLinks] });
}

export async function updateLinkLayout(layout: LinkLayout): Promise<DashboardConfig> {
  const config = await loadDashboardConfig();
  return saveDashboardConfig({ ...config, linkLayout: layout === "grid" ? "grid" : "grouped" });
}

export async function loadServiceTemplates(): Promise<ServiceTemplate[]> {
  const raw = await readFile(getTemplatesPath(), "utf-8");
  const parsed = JSON.parse(raw) as { templates?: ServiceTemplate[] };

  if (!Array.isArray(parsed.templates)) {
    throw new Error("Invalid templates config: expected templates array");
  }

  return parsed.templates;
}

export async function importDashboardLinks(inputs: DashboardLinkInput[]): Promise<{
  config: DashboardConfig;
  imported: number;
  skipped: number;
}> {
  const config = await loadDashboardConfig();
  const existingUrls = new Set(config.links.map((link) => keyUrl(link.url)));
  const nextLinks = [...config.links];
  let imported = 0;
  let skipped = 0;

  for (const input of inputs) {
    const link = cleanLinkInput(input);
    const urlKey = keyUrl(link.url);

    if (existingUrls.has(urlKey)) {
      skipped += 1;
      continue;
    }

    existingUrls.add(urlKey);
    nextLinks.push(link);
    imported += 1;
  }

  const nextConfig = await saveDashboardConfig({ ...config, links: nextLinks });
  return { config: nextConfig, imported, skipped };
}

export async function updateWidgetOrder(order: WidgetId[]): Promise<DashboardConfig> {
  const config = await loadDashboardConfig();
  const validOrder = order.filter((widget): widget is WidgetId => defaultWidgetOrder.includes(widget));
  const missingWidgets = defaultWidgetOrder.filter((widget) => !validOrder.includes(widget));

  return saveDashboardConfig({ ...config, widgetOrder: [...validOrder, ...missingWidgets] });
}

export async function updateWidgetSettings(order: WidgetId[], mobileOrder: WidgetId[] | undefined, widgets: WidgetFlags, layout?: WidgetLayout, style?: WidgetStyle): Promise<DashboardConfig> {
  const config = await loadDashboardConfig();
  const validOrder = order.filter((widget): widget is WidgetId => defaultWidgetOrder.includes(widget));
  const missingWidgets = defaultWidgetOrder.filter((widget) => !validOrder.includes(widget));
  const mobileOrderSource = mobileOrder?.length ? mobileOrder : config.mobileWidgetOrder ?? order;
  const validMobileOrder = mobileOrderSource.filter((widget): widget is WidgetId => defaultWidgetOrder.includes(widget));
  const missingMobileWidgets = defaultWidgetOrder.filter((widget) => !validMobileOrder.includes(widget));
  const nextWidgets = defaultWidgetOrder.reduce<WidgetFlags>((flags, widget) => {
    flags[widget] = Boolean(widgets[widget]);
    return flags;
  }, {});
  nextWidgets.rssTicker = Boolean(widgets.rssTicker);
  const widgetLayout = layout === "center" || layout === "rail" ? layout : "sidebar";
  const widgetStyle = style === "compact" || style === "dense" ? style : "cards";

  return saveDashboardConfig({
    ...config,
    widgets: nextWidgets,
    widgetOrder: [...validOrder, ...missingWidgets],
    mobileWidgetOrder: [...validMobileOrder, ...missingMobileWidgets],
    widgetLayout,
    widgetStyle
  });
}

export async function updateSearchSettings(input: SearchSettings): Promise<DashboardConfig> {
  const config = await loadDashboardConfig();
  const label = trimOptional(input.label) ?? defaultSearch.label;
  const urlTemplate = trimOptional(input.urlTemplate) ?? defaultSearch.urlTemplate;
  const visible = input.visible !== false;

  if (!urlTemplate.includes("{query}")) {
    throw new Error("Search URL template must include {query}");
  }

  try {
    new URL(urlTemplate.replace("{query}", "test"));
  } catch {
    throw new Error("Search URL template must be a valid URL");
  }

  return saveDashboardConfig({
    ...config,
    search: {
      label,
      urlTemplate,
      visible
    }
  });
}

export async function updateAppearanceSettings(input: AppearanceSettings): Promise<DashboardConfig> {
  const config = await loadDashboardConfig();
  return saveDashboardConfig({
    ...config,
    appearance: cleanAppearanceSettings(input)
  });
}

function trimOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function cleanQBittorrentLimit(value?: number) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 5;
  }

  return Math.min(10, Math.max(0, Math.round(numeric)));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function cleanControlEntityIds(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.includes("."))
    .slice(0, 6);
}

export async function updateIntegrationSettings(input: IntegrationSettingsInput): Promise<DashboardConfig> {
  const config = await loadDashboardConfig();
  const secrets = await loadSecretSettings();
  const nextSecrets: SecretSettings = {
    ...secrets,
    plex: { ...secrets.plex },
    unifi: { ...secrets.unifi },
    qbittorrent: { ...secrets.qbittorrent },
    gluetun: { ...secrets.gluetun },
    mail: { ...secrets.mail }
  };

  if (input.plex) {
    nextSecrets.plex = {
      ...nextSecrets.plex,
      token: trimOptional(input.plex.token) ?? nextSecrets.plex?.token
    };
  }

  if (input.unifi) {
    nextSecrets.unifi = {
      ...nextSecrets.unifi,
      username: trimOptional(input.unifi.username) ?? nextSecrets.unifi?.username,
      password: trimOptional(input.unifi.password) ?? nextSecrets.unifi?.password
    };
  }

  if (input.qbittorrent) {
    nextSecrets.qbittorrent = {
      ...nextSecrets.qbittorrent,
      username: trimOptional(input.qbittorrent.username) ?? nextSecrets.qbittorrent?.username,
      password: trimOptional(input.qbittorrent.password) ?? nextSecrets.qbittorrent?.password
    };
  }

  if (input.gluetun) {
    nextSecrets.gluetun = {
      ...nextSecrets.gluetun,
      apiKey: trimOptional(input.gluetun.apiKey) ?? nextSecrets.gluetun?.apiKey
    };
  }

  if (input.mail) {
    nextSecrets.mail = {
      ...nextSecrets.mail,
      password: trimOptional(input.mail.password) ?? nextSecrets.mail?.password
    };
  }

  const nextAdditionalSecrets = { ...nextSecrets.additional };
  const nextAdditionalIntegrations = { ...cleanAdditionalPublicIntegrations(config.integrations?.additional) };

  if (input.additional) {
    for (const definition of serviceDefinitions) {
      const id = definition.id as AdditionalIntegrationId;
      const item = input.additional[id];

      if (!item) {
        continue;
      }

      nextAdditionalIntegrations[id] = {
        ...cleanAdditionalPublicSettings(nextAdditionalIntegrations[id]),
        baseUrl: trimOptional(item.baseUrl) ?? nextAdditionalIntegrations[id]?.baseUrl,
        slug: trimOptional(item.slug) ?? nextAdditionalIntegrations[id]?.slug,
        enabled: typeof item.enabled === "boolean" ? item.enabled : nextAdditionalIntegrations[id]?.enabled,
        showMetrics: typeof item.showMetrics === "boolean" ? item.showMetrics : nextAdditionalIntegrations[id]?.showMetrics,
        controlEntityIds: cleanControlEntityIds(item.controlEntityIds) ?? nextAdditionalIntegrations[id]?.controlEntityIds
      };

      nextAdditionalSecrets[id] = {
        ...nextAdditionalSecrets[id],
        apiKey: trimOptional(item.apiKey) ?? nextAdditionalSecrets[id]?.apiKey,
        token: trimOptional(item.token) ?? nextAdditionalSecrets[id]?.token,
        username: trimOptional(item.username) ?? nextAdditionalSecrets[id]?.username,
        password: trimOptional(item.password) ?? nextAdditionalSecrets[id]?.password
      };
    }

    nextSecrets.additional = nextAdditionalSecrets;
  }

  const nextDocker = input.docker?.sources
    ? {
        ...config.integrations?.docker,
        sources: cleanDockerSources(input.docker.sources),
        socketPath: trimOptional(input.docker.socketPath) ?? config.integrations?.docker?.socketPath
      }
    : {
        ...config.integrations?.docker,
        socketPath: trimOptional(input.docker?.socketPath) ?? config.integrations?.docker?.socketPath
      };

  const nextConfig = await saveDashboardConfig({
    ...config,
    integrations: {
      ...config.integrations,
      docker: nextDocker,
      plex: {
        ...config.integrations?.plex,
        baseUrl: trimOptional(input.plex?.baseUrl) ?? config.integrations?.plex?.baseUrl,
        showRecentlyAdded: input.plex?.showRecentlyAdded ?? config.integrations?.plex?.showRecentlyAdded ?? true
      },
      unifi: {
        ...config.integrations?.unifi,
        baseUrl: trimOptional(input.unifi?.baseUrl) ?? config.integrations?.unifi?.baseUrl,
        site: trimOptional(input.unifi?.site) ?? config.integrations?.unifi?.site ?? "default"
      },
      ollama: {
        ...config.integrations?.ollama,
        baseUrl: trimOptional(input.ollama?.baseUrl) ?? config.integrations?.ollama?.baseUrl,
        model: trimOptional(input.ollama?.model) ?? config.integrations?.ollama?.model
      },
      qbittorrent: {
        ...config.integrations?.qbittorrent,
        baseUrl: trimOptional(input.qbittorrent?.baseUrl) ?? config.integrations?.qbittorrent?.baseUrl,
        showNames: input.qbittorrent?.showNames ?? config.integrations?.qbittorrent?.showNames ?? false,
        torrentLimit: input.qbittorrent
          ? cleanQBittorrentLimit(input.qbittorrent.torrentLimit)
          : config.integrations?.qbittorrent?.torrentLimit,
        speedUnit: input.qbittorrent?.speedUnit === "mbs" ? "mbs" : config.integrations?.qbittorrent?.speedUnit ?? "mbps"
      },
      gluetun: {
        ...config.integrations?.gluetun,
        dockerSourceId: trimOptional(input.gluetun?.dockerSourceId) ?? config.integrations?.gluetun?.dockerSourceId ?? "local",
        containerName: trimOptional(input.gluetun?.containerName) ?? config.integrations?.gluetun?.containerName ?? "gluetun",
        controlUrl: trimOptional(input.gluetun?.controlUrl)?.replace(/\/+$/, "") ?? config.integrations?.gluetun?.controlUrl,
        expectedHostIp: trimOptional(input.gluetun?.expectedHostIp) ?? config.integrations?.gluetun?.expectedHostIp
      },
      mail: input.mail
        ? {
            ...config.integrations?.mail,
            providerName: trimOptional(input.mail.providerName) ?? config.integrations?.mail?.providerName,
            host: trimOptional(input.mail.host) ?? config.integrations?.mail?.host,
            port: input.mail.port ? clampInteger(input.mail.port, 1, 65535, 993) : config.integrations?.mail?.port,
            secure: typeof input.mail.secure === "boolean" ? input.mail.secure : config.integrations?.mail?.secure ?? true,
            username: trimOptional(input.mail.username) ?? config.integrations?.mail?.username,
            mailbox: trimOptional(input.mail.mailbox) ?? config.integrations?.mail?.mailbox ?? "INBOX",
            maxItems: clampInteger(input.mail.maxItems, 1, 20, 8),
            unreadAlertThreshold: clampInteger(input.mail.unreadAlertThreshold, 0, 999, 0),
            openUrl: trimOptional(input.mail.openUrl) ?? config.integrations?.mail?.openUrl
          }
        : config.integrations?.mail,
      additional: input.additional ? nextAdditionalIntegrations : config.integrations?.additional
    },
    widgets: input.ollama || input.qbittorrent || input.gluetun || input.mail || input.additional
      ? {
          ...config.widgets,
          ...(input.ollama ? { ollama: true } : {}),
          ...(input.qbittorrent ? { qbittorrent: true } : {}),
          ...(input.gluetun ? { gluetun: true } : {}),
          ...(input.mail ? { mail: true } : {}),
          ...Object.fromEntries(
            Object.entries(input.additional ?? {})
              .filter(([, value]) => value?.enabled)
              .map(([id]) => [id, true])
          )
        }
      : config.widgets
  });

  await saveSecretSettings(nextSecrets);

  return nextConfig;
}

export async function deleteIntegrationSettings(id: IntegrationId): Promise<DashboardConfig> {
  const config = await loadDashboardConfig();
  const secrets = await loadSecretSettings();
  const nextIntegrations = { ...config.integrations };
  const nextSecrets: SecretSettings = { ...secrets };

  if (id === "docker") {
    delete nextIntegrations.docker;
  }

  if (id === "plex") {
    delete nextIntegrations.plex;
    delete nextSecrets.plex;
  }

  if (id === "unifi") {
    delete nextIntegrations.unifi;
    delete nextSecrets.unifi;
  }

  if (id === "ollama") {
    delete nextIntegrations.ollama;
  }

  if (id === "qbittorrent") {
    delete nextIntegrations.qbittorrent;
    delete nextSecrets.qbittorrent;
  }

  if (id === "gluetun") {
    delete nextIntegrations.gluetun;
    delete nextSecrets.gluetun;
  }

  if (id === "mail") {
    delete nextIntegrations.mail;
    delete nextSecrets.mail;
  }

  if (serviceDefinitions.some((definition) => definition.id === id)) {
    const additional = { ...nextIntegrations.additional };
    delete additional[id as AdditionalIntegrationId];
    nextIntegrations.additional = additional;

    const additionalSecrets = { ...nextSecrets.additional };
    delete additionalSecrets[id as AdditionalIntegrationId];
    nextSecrets.additional = additionalSecrets;
  }

  const nextConfig = await saveDashboardConfig({
    ...config,
    integrations: nextIntegrations,
    widgets: {
      ...config.widgets,
      [id]: false
    }
  });

  await saveSecretSettings(nextSecrets);

  return nextConfig;
}
