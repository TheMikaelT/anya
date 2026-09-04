import type { DashboardConfig, DockerSource, DockerSuggestion, ServiceTemplate } from "../types.js";
import { getDockerSources, requestDocker } from "./docker.js";

interface DockerPort {
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  Ports: DockerPort[];
}

function normalizeName(name: string) {
  return name.replace(/^\//, "").toLowerCase();
}

function findTemplate(container: DockerContainer, templates: ServiceTemplate[]) {
  const haystack = `${container.Names.map(normalizeName).join(" ")} ${container.Image}`.toLowerCase();
  return templates.find((template) => haystack.includes(template.id) || haystack.includes(template.name.toLowerCase()));
}

function firstPublicPort(container: DockerContainer, template?: ServiceTemplate) {
  const templatePort = template?.defaultUrl.match(/:(\d+)(?:\/|$)/)?.[1];
  const matchingTemplatePort = container.Ports.find(
    (port) => templatePort && port.PublicPort && String(port.PrivatePort) === templatePort
  );

  return matchingTemplatePort?.PublicPort ?? container.Ports.find((port) => port.PublicPort)?.PublicPort;
}

async function discoverDockerSourceServices(source: DockerSource, templates: ServiceTemplate[], host: string): Promise<DockerSuggestion[]> {
  const containers = await requestDocker<DockerContainer[]>(source, "/containers/json");

  return containers.flatMap((container) => {
    const name = normalizeName(container.Names[0] ?? container.Id.slice(0, 12));
    const lowerName = name.toLowerCase();
    if (lowerName.startsWith("homedeck-test_") || lowerName.includes("homedeck") || lowerName.includes("anya")) {
      return [];
    }

    const template = findTemplate(container, templates);
    const publicPort = firstPublicPort(container, template);

    if (!publicPort && !template) {
      return [];
    }

    const defaultScheme = template?.defaultUrl.startsWith("https") ? "https" : "http";
    const url = template?.defaultUrl.includes("{host}")
      ? template.defaultUrl.replace("{host}", host)
      : `${defaultScheme}://${host}:${publicPort}`;

    return [
      {
        source: "docker",
        dockerSourceId: source.id,
        dockerSourceName: source.name,
        container: name,
        image: container.Image,
        name: template?.name ?? name,
        url,
        description: template?.description ?? `Docker container: ${container.Image}`,
        category: template?.category ?? "Docker",
        icon: template?.icon ?? "container",
        iconUrl: template?.iconUrl
      }
    ];
  });
}

export async function discoverDockerServices(templates: ServiceTemplate[], host: string, config?: DashboardConfig): Promise<DockerSuggestion[]> {
  const sources = getDockerSources(config);
  const results = await Promise.allSettled(sources.map((source) => discoverDockerSourceServices(source, templates, host)));

  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}
