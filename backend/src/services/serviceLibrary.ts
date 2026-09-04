import type { DashboardLink, ServiceTemplate } from "../types.js";
import { linksResponse, loadDashboardConfig, loadServiceTemplates, saveDashboardConfig } from "./config.js";
import { findIconForService, normalizeIconKey, refreshIconCatalog } from "./iconCatalog.js";

function findTemplate(link: DashboardLink, templates: ServiceTemplate[]) {
  const haystack = normalizeIconKey(`${link.name} ${link.url} ${link.description}`);
  return templates.find((template) => {
    const keys = [template.id, template.name, ...(template.aliases ?? [])].map(normalizeIconKey);
    return keys.some((key) => key && haystack.includes(key));
  });
}

function shouldReplaceDescription(description: string | undefined) {
  const value = description?.trim().toLowerCase();
  return !value || value === "no description" || value === "imported from heimdall" || value.startsWith("docker container:");
}

export async function refreshServiceLibrary() {
  const [config, templates, catalog] = await Promise.all([
    loadDashboardConfig(),
    loadServiceTemplates(),
    refreshIconCatalog()
  ]);
  let updated = 0;

  const links = config.links.map((link) => {
    const template = findTemplate(link, templates);
    const catalogIcon = findIconForService(catalog.items, link.name, link.url);
    const next = { ...link };

    if (!next.iconUrl && (template?.iconUrl || catalogIcon?.iconUrl)) {
      next.iconUrl = template?.iconUrl ?? catalogIcon?.iconUrl;
    }

    if ((!next.icon || next.icon === "server") && template?.icon) {
      next.icon = template.icon;
    }

    if (template?.description && shouldReplaceDescription(next.description)) {
      next.description = template.description;
    }

    if (
      next.iconUrl !== link.iconUrl ||
      next.icon !== link.icon ||
      next.description !== link.description
    ) {
      updated += 1;
    }

    return next;
  });

  const nextConfig = await saveDashboardConfig({ ...config, links });

  return {
    updated,
    icons: catalog.items.length,
    ...linksResponse(nextConfig)
  };
}
