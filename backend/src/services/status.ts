import type { DashboardLink, ServiceStatus } from "../types.js";

const timeoutMs = 2500;

export async function checkServiceStatuses(links: DashboardLink[]): Promise<ServiceStatus[]> {
  return Promise.all(
    links.map(async (link) => {
      const started = Date.now();

      try {
        const response = await fetch(link.url, {
          method: "HEAD",
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "manual"
        });

        return {
          id: link.id ?? link.name,
          status: "online",
          httpStatus: response.status,
          latencyMs: Date.now() - started
        } satisfies ServiceStatus;
      } catch (headError) {
        try {
          const response = await fetch(link.url, {
            method: "GET",
            signal: AbortSignal.timeout(timeoutMs),
            redirect: "manual"
          });

          return {
            id: link.id ?? link.name,
            status: "online",
            httpStatus: response.status,
            latencyMs: Date.now() - started
          } satisfies ServiceStatus;
        } catch (getError) {
          const error = getError instanceof Error ? getError.message : "Status check failed";
          return {
            id: link.id ?? link.name,
            status: "offline",
            latencyMs: Date.now() - started,
            error
          } satisfies ServiceStatus;
        }
      }
    })
  );
}
