import { Activity, Bot, Boxes, CheckCircle2, Download, Film, Gauge, HardDrive, Home, Loader2, Mail, Network, Plus, RadioTower, Save, Server, Shield, Trash2, Tv, X, XCircle } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { AdditionalIntegrationId, DockerSourceInput, IntegrationId, IntegrationInfo, IntegrationSettingsInput, IntegrationTestResult } from "../types";

interface IntegrationGuideModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const icons = {
  docker: Boxes,
  gluetun: Shield,
  plex: Film,
  unifi: Network,
  ollama: Bot,
  qbittorrent: Download,
  mail: Mail,
  homeassistant: Home,
  proxmox: Server,
  truenas: HardDrive,
  pihole: Shield,
  adguard: Shield,
  uptimekuma: Activity,
  portainer: Boxes,
  sonarr: Tv,
  radarr: Film,
  lidarr: Download,
  readarr: Download,
  jellyfin: Film,
  tautulli: Gauge,
  nginxproxymanager: Network,
  traefik: RadioTower
};

const additionalIds: AdditionalIntegrationId[] = [
  "homeassistant",
  "proxmox",
  "truenas",
  "pihole",
  "adguard",
  "uptimekuma",
  "portainer",
  "sonarr",
  "radarr",
  "lidarr",
  "readarr",
  "jellyfin",
  "tautulli",
  "nginxproxymanager",
  "traefik"
];

const additionalAuth: Record<AdditionalIntegrationId, "apiKey" | "token" | "basic" | "slug" | "none"> = {
  homeassistant: "token",
  proxmox: "token",
  truenas: "apiKey",
  pihole: "apiKey",
  adguard: "basic",
  uptimekuma: "slug",
  portainer: "apiKey",
  sonarr: "apiKey",
  radarr: "apiKey",
  lidarr: "apiKey",
  readarr: "apiKey",
  jellyfin: "apiKey",
  tautulli: "apiKey",
  nginxproxymanager: "basic",
  traefik: "none"
};

const statusStyles = {
  configured: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  available: "border-sky-300/25 bg-sky-300/10 text-sky-100",
  needs_config: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  failing: "border-rose-300/25 bg-rose-300/10 text-rose-100"
};

const emptyForm: IntegrationSettingsInput = {
  docker: {
    socketPath: "/var/run/docker.sock",
    sources: [{ id: "local", name: "Local Docker", type: "socket", enabled: true, socketPath: "/var/run/docker.sock" }]
  },
  plex: { baseUrl: "", token: "", showRecentlyAdded: true },
  unifi: { baseUrl: "", username: "", password: "", site: "default" },
  ollama: { baseUrl: "", model: "" },
  qbittorrent: {
    baseUrl: "https://qbittorrent.example.local",
    username: "",
    password: "",
    showNames: false,
    torrentLimit: 5,
    speedUnit: "mbps"
  },
  gluetun: {
    dockerSourceId: "local",
    containerName: "gluetun",
    controlUrl: "",
    apiKey: "",
    expectedHostIp: ""
  },
  mail: {
    providerName: "Mail",
    host: "",
    port: 993,
    secure: true,
    username: "",
    password: "",
    mailbox: "INBOX",
    maxItems: 8,
    unreadAlertThreshold: 0,
    openUrl: ""
  },
  additional: {}
};

function dockerSourcesFromSettings(settings?: IntegrationInfo["settings"]): DockerSourceInput[] {
  const sources = settings?.sources as DockerSourceInput[] | undefined;

  if (Array.isArray(sources)) {
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      type: source.type,
      enabled: source.enabled !== false,
      socketPath: source.socketPath,
      baseUrl: source.baseUrl
    }));
  }

  return [
    {
      id: "local",
      name: "Local Docker",
      type: "socket",
      enabled: true,
      socketPath: String(settings?.socketPath ?? "/var/run/docker.sock")
    }
  ];
}

function newDockerSource(index: number): DockerSourceInput {
  return {
    id: `docker-${Date.now()}-${index}`,
    name: `Docker ${index + 1}`,
    type: "http",
    enabled: true,
    baseUrl: "http://docker-proxy.example.local:2375"
  };
}

export default function IntegrationGuideModal({ open, onClose, onSaved }: IntegrationGuideModalProps) {
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [form, setForm] = useState<IntegrationSettingsInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<IntegrationId | null>(null);
  const [testResults, setTestResults] = useState<Partial<Record<IntegrationId, IntegrationTestResult>>>({});

  function applyIntegrations(items: IntegrationInfo[]) {
    setIntegrations(items);
    const docker = items.find((item) => item.id === "docker");
    const plex = items.find((item) => item.id === "plex");
    const unifi = items.find((item) => item.id === "unifi");
    const ollama = items.find((item) => item.id === "ollama");
    const qbittorrent = items.find((item) => item.id === "qbittorrent");
    const gluetun = items.find((item) => item.id === "gluetun");
    const mail = items.find((item) => item.id === "mail");
    const additional = Object.fromEntries(
      additionalIds.map((id) => {
        const item = items.find((integrationItem) => integrationItem.id === id);
        return [
          id,
          {
            baseUrl: String(item?.settings.baseUrl ?? ""),
            slug: String(item?.settings.slug ?? ""),
            enabled: item?.settings.enabled === true,
            apiKey: "",
            token: "",
            username: "",
            password: ""
          }
        ];
      })
    );

    setForm({
      docker: {
        socketPath: String(docker?.settings.socketPath ?? "/var/run/docker.sock"),
        sources: dockerSourcesFromSettings(docker?.settings)
      },
      plex: {
        baseUrl: String(plex?.settings.baseUrl ?? ""),
        token: "",
        showRecentlyAdded: plex?.settings.showRecentlyAdded !== false
      },
      unifi: {
        baseUrl: String(unifi?.settings.baseUrl ?? ""),
        site: String(unifi?.settings.site ?? "default"),
        username: "",
        password: ""
      },
      ollama: {
        baseUrl: String(ollama?.settings.baseUrl ?? ""),
        model: String(ollama?.settings.model ?? "")
      },
      qbittorrent: {
        baseUrl: String(qbittorrent?.settings.baseUrl || "https://qbittorrent.example.local"),
        username: "",
        password: "",
        showNames: qbittorrent?.settings.showNames === true,
        torrentLimit: Number(qbittorrent?.settings.torrentLimit ?? 5),
        speedUnit: qbittorrent?.settings.speedUnit === "mbs" ? "mbs" : "mbps"
      },
      gluetun: {
        dockerSourceId: String(gluetun?.settings.dockerSourceId ?? "local"),
        containerName: String(gluetun?.settings.containerName ?? "gluetun"),
        controlUrl: String(gluetun?.settings.controlUrl ?? ""),
        apiKey: "",
        expectedHostIp: String(gluetun?.settings.expectedHostIp ?? "")
      },
      mail: {
        providerName: String(mail?.settings.providerName ?? "Mail"),
        host: String(mail?.settings.host ?? ""),
        port: Number(mail?.settings.port ?? 993),
        secure: mail?.settings.secure !== false,
        username: String(mail?.settings.username ?? ""),
        password: "",
        mailbox: String(mail?.settings.mailbox ?? "INBOX"),
        maxItems: Number(mail?.settings.maxItems ?? 8),
        unreadAlertThreshold: Number(mail?.settings.unreadAlertThreshold ?? 0),
        openUrl: String(mail?.settings.openUrl ?? "")
      },
      additional
    });
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    api
      .integrations()
      .then((data) => {
        applyIntegrations(data.integrations);
        setError(null);
        setNotice(null);
        setTestResults({});
      })
      .catch((err: Error) => setError(err.message));
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const data = await api.updateIntegrations(form);
      applyIntegrations(data.integrations);
      setNotice("Integrations saved.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saving integrations failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: IntegrationId) {
    const item = integration(id);
    const confirmed = window.confirm(
      `Remove ${item?.name ?? id} integration settings? Saved local secrets for this integration will be deleted.`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const data = await api.deleteIntegration(id);
      applyIntegrations(data.integrations);
      setNotice(`${item?.name ?? id} integration removed.`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Removing integration failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(id: IntegrationId) {
    setTesting(id);
    setError(null);

    try {
      const saved = await api.updateIntegrations(form);
      applyIntegrations(saved.integrations);
      onSaved();
      const result = await api.testIntegration(id);
      setTestResults((current) => ({ ...current, [id]: result }));
    } catch (err) {
      setTestResults((current) => ({
        ...current,
        [id]: {
          id,
          ok: false,
          status: "offline",
          configured: false,
          durationMs: 0,
          error: err instanceof Error ? err.message : "Connection test failed"
        }
      }));
    } finally {
      setTesting(null);
    }
  }

  function integration(id: IntegrationInfo["id"]) {
    return integrations.find((item) => item.id === id);
  }

  function updateAdditional(id: AdditionalIntegrationId, patch: NonNullable<IntegrationSettingsInput["additional"]>[AdditionalIntegrationId]) {
    setForm((current) => ({
      ...current,
      additional: {
        ...current.additional,
        [id]: {
          ...current.additional?.[id],
          ...patch
        }
      }
    }));
  }

  function updateDockerSource(index: number, patch: Partial<DockerSourceInput>) {
    setForm((current) => {
      const sources = [...(current.docker?.sources ?? [])];
      const nextSource = { ...sources[index], ...patch };

      if (patch.type === "socket") {
        nextSource.baseUrl = undefined;
        nextSource.socketPath = nextSource.socketPath || "/var/run/docker.sock";
      }

      if (patch.type === "http") {
        nextSource.socketPath = undefined;
        nextSource.baseUrl = nextSource.baseUrl || "http://docker-proxy.example.local:2375";
      }

      sources[index] = nextSource;

      return {
        ...current,
        docker: {
          ...current.docker,
          socketPath: sources.find((source) => source.type === "socket")?.socketPath ?? current.docker?.socketPath,
          sources
        }
      };
    });
  }

  function addDockerSource() {
    setForm((current) => {
      const sources = current.docker?.sources ?? [];
      return {
        ...current,
        docker: {
          ...current.docker,
          sources: [...sources, newDockerSource(sources.length)]
        }
      };
    });
  }

  function removeDockerSource(index: number) {
    setForm((current) => {
      const sources = [...(current.docker?.sources ?? [])];
      sources.splice(index, 1);
      return {
        ...current,
        docker: {
          ...current.docker,
          sources
        }
      };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 backdrop-blur sm:items-center sm:justify-center">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-deck-900 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-100/80">Integrations</p>
            <h2 className="text-xl font-semibold text-white">Configure live widgets</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close integrations"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
            Tokens and passwords are saved only to local <code>config/secrets.json</code>. They are never returned to the browser after saving.
          </div>

          {error ? <div className="mb-4 rounded-xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div> : null}
          {notice ? <div className="mb-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">{notice}</div> : null}

          <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {integrations.map((item) => {
              const Icon = icons[item.id];
              const result = testResults[item.id];
              const resultClass = result
                ? result.ok
                  ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                  : "border-rose-300/25 bg-rose-300/10 text-rose-100"
                : statusStyles[item.status];

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleTest(item.id)}
                  disabled={testing !== null || saving}
                  className={`rounded-xl border p-3 text-left transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60 ${resultClass}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Icon className="h-4 w-4" />
                    {testing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : result?.ok ? <CheckCircle2 className="h-4 w-4" /> : result ? <XCircle className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold">{item.name}</p>
                  <p className="mt-1 truncate text-xs opacity-75">
                    {result ? `${result.status} · ${result.durationMs} ms` : item.status.replace("_", " ")}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4">
            <IntegrationSection
              info={integration("docker")}
              result={testResults.docker}
              testing={testing === "docker"}
              onTest={() => void handleTest("docker")}
              onRemove={() => void handleRemove("docker")}
              actionDisabled={saving || testing !== null}
            >
              <div className="space-y-3">
                {(form.docker?.sources ?? []).map((source, index) => (
                  <div key={source.id ?? index} className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_6rem_auto] sm:items-end">
                      <Field label="Name">
                        <input
                          value={source.name}
                          onChange={(event) => updateDockerSource(index, { name: event.target.value })}
                          className="input"
                          placeholder="Media Docker"
                        />
                      </Field>
                      <Field label="Type">
                        <select
                          value={source.type}
                          onChange={(event) => updateDockerSource(index, { type: event.target.value === "http" ? "http" : "socket" })}
                          className="input"
                        >
                          <option value="socket">Local socket</option>
                          <option value="http">Socket proxy</option>
                        </select>
                      </Field>
                      <label className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={source.enabled !== false}
                          onChange={(event) => updateDockerSource(index, { enabled: event.target.checked })}
                        />
                        Enabled
                      </label>
                      <button
                        type="button"
                        onClick={() => removeDockerSource(index)}
                        disabled={(form.docker?.sources ?? []).length <= 1}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-rose-300/20 px-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                    <div className="mt-3">
                      {source.type === "socket" ? (
                        <Field label="Socket path">
                          <input
                            value={source.socketPath ?? ""}
                            onChange={(event) => updateDockerSource(index, { socketPath: event.target.value })}
                            className="input"
                            placeholder="/var/run/docker.sock"
                          />
                        </Field>
                      ) : (
                        <Field label="Docker Socket Proxy URL">
                          <input
                            value={source.baseUrl ?? ""}
                            onChange={(event) => updateDockerSource(index, { baseUrl: event.target.value })}
                            className="input"
                            placeholder="http://docker-proxy.example.local:2375"
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDockerSource}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  <Plus className="h-4 w-4" />
                  Add Docker source
                </button>
              </div>
            </IntegrationSection>

            <IntegrationSection
              info={integration("gluetun")}
              result={testResults.gluetun}
              testing={testing === "gluetun"}
              onTest={() => void handleTest("gluetun")}
              onRemove={() => void handleRemove("gluetun")}
              actionDisabled={saving || testing !== null}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Gluetun control URL">
                  <input
                    value={form.gluetun?.controlUrl ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, gluetun: { ...current.gluetun, controlUrl: event.target.value } }))}
                    className="input"
                    placeholder="http://gluetun.example.local:8000"
                  />
                </Field>
                <Field label={`Control API key${integration("gluetun")?.settings.hasApiKey ? " (saved)" : ""}`}>
                  <input
                    value={form.gluetun?.apiKey ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, gluetun: { ...current.gluetun, apiKey: event.target.value } }))}
                    className="input"
                    type="password"
                    placeholder={integration("gluetun")?.settings.hasApiKey ? "Leave blank to keep current key" : "Optional"}
                  />
                </Field>
                <Field label="Docker source">
                  <select
                    value={form.gluetun?.dockerSourceId ?? "local"}
                    onChange={(event) => setForm((current) => ({ ...current, gluetun: { ...current.gluetun, dockerSourceId: event.target.value } }))}
                    className="input"
                  >
                    {(form.docker?.sources ?? []).map((source, index) => (
                      <option key={source.id ?? index} value={source.id ?? "local"}>
                        {source.name || source.id || `Docker ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Gluetun container">
                  <input
                    value={form.gluetun?.containerName ?? "gluetun"}
                    onChange={(event) => setForm((current) => ({ ...current, gluetun: { ...current.gluetun, containerName: event.target.value } }))}
                    className="input"
                    placeholder="gluetun"
                  />
                </Field>
                <Field label="Home/WAN IP optional">
                  <input
                    value={form.gluetun?.expectedHostIp ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, gluetun: { ...current.gluetun, expectedHostIp: event.target.value } }))}
                    className="input"
                    placeholder="Auto detect"
                  />
                </Field>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                For a remote Gluetun host, use the Gluetun control URL. Docker source URL must be a Docker Socket Proxy/API URL, not the qBittorrent or Gluetun application port. If the VPN IP matches the host/WAN IP, the widget warns about a possible leak.
              </p>
            </IntegrationSection>

            <IntegrationSection
              info={integration("plex")}
              result={testResults.plex}
              testing={testing === "plex"}
              onTest={() => void handleTest("plex")}
              onRemove={() => void handleRemove("plex")}
              actionDisabled={saving || testing !== null}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Plex base URL">
                  <input
                    value={form.plex?.baseUrl ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, plex: { ...current.plex, baseUrl: event.target.value } }))}
                    className="input"
                    placeholder="http://plex.local:32400"
                  />
                </Field>
                <Field label={`Plex token${integration("plex")?.settings.hasToken ? " (saved)" : ""}`}>
                  <input
                    value={form.plex?.token ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, plex: { ...current.plex, token: event.target.value } }))}
                    className="input"
                    type="password"
                    placeholder={integration("plex")?.settings.hasToken ? "Leave blank to keep current token" : "Paste Plex token"}
                  />
                </Field>
              </div>
            </IntegrationSection>

            <IntegrationSection
              info={integration("unifi")}
              result={testResults.unifi}
              testing={testing === "unifi"}
              onTest={() => void handleTest("unifi")}
              onRemove={() => void handleRemove("unifi")}
              actionDisabled={saving || testing !== null}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="UniFi base URL">
                  <input
                    value={form.unifi?.baseUrl ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, unifi: { ...current.unifi, baseUrl: event.target.value } }))}
                    className="input"
                    placeholder="https://unifi.local"
                  />
                </Field>
                <Field label="Site">
                  <input
                    value={form.unifi?.site ?? "default"}
                    onChange={(event) => setForm((current) => ({ ...current, unifi: { ...current.unifi, site: event.target.value } }))}
                    className="input"
                    placeholder="default"
                  />
                </Field>
                <Field label={`Username${integration("unifi")?.settings.hasUsername ? " (saved)" : ""}`}>
                  <input
                    value={form.unifi?.username ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, unifi: { ...current.unifi, username: event.target.value } }))}
                    className="input"
                    placeholder={integration("unifi")?.settings.hasUsername ? "Leave blank to keep current username" : "UniFi username"}
                  />
                </Field>
                <Field label={`Password${integration("unifi")?.settings.hasPassword ? " (saved)" : ""}`}>
                  <input
                    value={form.unifi?.password ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, unifi: { ...current.unifi, password: event.target.value } }))}
                    className="input"
                    type="password"
                    placeholder={integration("unifi")?.settings.hasPassword ? "Leave blank to keep current password" : "UniFi password"}
                  />
                </Field>
              </div>
            </IntegrationSection>

            <IntegrationSection
              info={integration("ollama")}
              result={testResults.ollama}
              testing={testing === "ollama"}
              onTest={() => void handleTest("ollama")}
              onRemove={() => void handleRemove("ollama")}
              actionDisabled={saving || testing !== null}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ollama base URL">
                  <input
                    value={form.ollama?.baseUrl ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, ollama: { ...current.ollama, baseUrl: event.target.value } }))}
                    className="input"
                    placeholder="http://ollama.example.local:11434"
                  />
                </Field>
                <Field label="Default model">
                  <input
                    value={form.ollama?.model ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, ollama: { ...current.ollama, model: event.target.value } }))}
                    className="input"
                    placeholder="llama3.1:8b"
                  />
                </Field>
              </div>
            </IntegrationSection>

            <IntegrationSection
              info={integration("qbittorrent")}
              result={testResults.qbittorrent}
              testing={testing === "qbittorrent"}
              onTest={() => void handleTest("qbittorrent")}
              onRemove={() => void handleRemove("qbittorrent")}
              actionDisabled={saving || testing !== null}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="qBittorrent Web UI URL">
                  <input
                    value={form.qbittorrent?.baseUrl ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, qbittorrent: { ...current.qbittorrent, baseUrl: event.target.value } }))}
                    className="input"
                    placeholder="https://qbittorrent.example.local"
                  />
                </Field>
                <Field label={`Username${integration("qbittorrent")?.settings.hasUsername ? " (saved)" : ""}`}>
                  <input
                    value={form.qbittorrent?.username ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, qbittorrent: { ...current.qbittorrent, username: event.target.value } }))}
                    className="input"
                    placeholder={integration("qbittorrent")?.settings.hasUsername ? "Leave blank to keep current username" : "qBittorrent username"}
                  />
                </Field>
                <Field label={`Password${integration("qbittorrent")?.settings.hasPassword ? " (saved)" : ""}`}>
                  <input
                    value={form.qbittorrent?.password ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, qbittorrent: { ...current.qbittorrent, password: event.target.value } }))}
                    className="input"
                    type="password"
                    placeholder={integration("qbittorrent")?.settings.hasPassword ? "Leave blank to keep current password" : "qBittorrent password"}
                  />
                </Field>
              </div>
            </IntegrationSection>

            <IntegrationSection
              info={integration("mail")}
              result={testResults.mail}
              testing={testing === "mail"}
              onTest={() => void handleTest("mail")}
              onRemove={() => void handleRemove("mail")}
              actionDisabled={saving || testing !== null}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Provider name">
                  <input
                    value={form.mail?.providerName ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, mail: { ...current.mail, providerName: event.target.value } }))}
                    className="input"
                    placeholder="Gmail"
                  />
                </Field>
                <Field label="Open mailbox URL optional">
                  <input
                    value={form.mail?.openUrl ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, mail: { ...current.mail, openUrl: event.target.value } }))}
                    className="input"
                    placeholder="https://mail.google.com"
                  />
                </Field>
                <Field label="IMAP host">
                  <input
                    value={form.mail?.host ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, mail: { ...current.mail, host: event.target.value } }))}
                    className="input"
                    placeholder="imap.gmail.com"
                  />
                </Field>
                <Field label="Port">
                  <input
                    value={form.mail?.port ?? 993}
                    onChange={(event) => setForm((current) => ({ ...current, mail: { ...current.mail, port: Number(event.target.value) } }))}
                    className="input"
                    type="number"
                    min={1}
                    max={65535}
                  />
                </Field>
                <label className="flex min-h-11 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.mail?.secure !== false}
                    onChange={(event) => setForm((current) => ({ ...current, mail: { ...current.mail, secure: event.target.checked } }))}
                  />
                  Use TLS
                </label>
                <Field label="Mailbox">
                  <input
                    value={form.mail?.mailbox ?? "INBOX"}
                    onChange={(event) => setForm((current) => ({ ...current, mail: { ...current.mail, mailbox: event.target.value } }))}
                    className="input"
                    placeholder="INBOX"
                  />
                </Field>
                <Field label="Username">
                  <input
                    value={form.mail?.username ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, mail: { ...current.mail, username: event.target.value } }))}
                    className="input"
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label={`Password / app password${integration("mail")?.settings.hasPassword ? " (saved)" : ""}`}>
                  <input
                    value={form.mail?.password ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, mail: { ...current.mail, password: event.target.value } }))}
                    className="input"
                    type="password"
                    placeholder={integration("mail")?.settings.hasPassword ? "Leave blank to keep current password" : "App password"}
                  />
                </Field>
                <Field label="Messages to show">
                  <input
                    value={form.mail?.maxItems ?? 8}
                    onChange={(event) => setForm((current) => ({ ...current, mail: { ...current.mail, maxItems: Number(event.target.value) } }))}
                    className="input"
                    type="number"
                    min={1}
                    max={20}
                  />
                </Field>
                <Field label="Unread alert threshold">
                  <input
                    value={form.mail?.unreadAlertThreshold ?? 0}
                    onChange={(event) => setForm((current) => ({ ...current, mail: { ...current.mail, unreadAlertThreshold: Number(event.target.value) } }))}
                    className="input"
                    type="number"
                    min={0}
                    max={999}
                  />
                </Field>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Anya opens IMAP read-only and only shows message headers. Use an app password where your provider supports it. Set unread alert threshold to 0 to disable mail notifications.
              </p>
            </IntegrationSection>

            <div className="pt-2">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Additional services</p>
              <div className="grid gap-4">
                {additionalIds.map((id) => {
                  const info = integration(id);
                  const auth = additionalAuth[id];
                  const settings = form.additional?.[id] ?? {};

                  return (
                    <IntegrationSection
                      key={id}
                      info={info}
                      result={testResults[id]}
                      testing={testing === id}
                      onTest={() => void handleTest(id)}
                      onRemove={() => void handleRemove(id)}
                      actionDisabled={saving || testing !== null}
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-slate-300 sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={settings.enabled === true}
                            onChange={(event) => updateAdditional(id, { enabled: event.target.checked })}
                          />
                          Enable in Services widget
                        </label>
                        <Field label="Base URL">
                          <input
                            value={settings.baseUrl ?? ""}
                            onChange={(event) => updateAdditional(id, { baseUrl: event.target.value })}
                            className="input"
                            placeholder={String(info?.settings.baseUrl || "http://service.local")}
                          />
                        </Field>
                        {auth === "slug" ? (
                          <Field label="Status page slug">
                            <input
                              value={settings.slug ?? ""}
                              onChange={(event) => updateAdditional(id, { slug: event.target.value })}
                              className="input"
                              placeholder="default"
                            />
                          </Field>
                        ) : null}
                        {auth === "apiKey" ? (
                          <Field label={`API key${info?.settings.hasApiKey ? " (saved)" : ""}`}>
                            <input
                              value={settings.apiKey ?? ""}
                              onChange={(event) => updateAdditional(id, { apiKey: event.target.value })}
                              className="input"
                              type="password"
                              placeholder={info?.settings.hasApiKey ? "Leave blank to keep current key" : "Paste API key"}
                            />
                          </Field>
                        ) : null}
                        {auth === "token" ? (
                          <Field label={`Token${info?.settings.hasToken ? " (saved)" : ""}`}>
                            <input
                              value={settings.token ?? ""}
                              onChange={(event) => updateAdditional(id, { token: event.target.value })}
                              className="input"
                              type="password"
                              placeholder={info?.settings.hasToken ? "Leave blank to keep current token" : "Paste token"}
                            />
                          </Field>
                        ) : null}
                        {auth === "basic" ? (
                          <>
                            <Field label={`Username${info?.settings.hasUsername ? " (saved)" : ""}`}>
                              <input
                                value={settings.username ?? ""}
                                onChange={(event) => updateAdditional(id, { username: event.target.value })}
                                className="input"
                                placeholder={info?.settings.hasUsername ? "Leave blank to keep current username" : "Username"}
                              />
                            </Field>
                            <Field label={`Password${info?.settings.hasPassword ? " (saved)" : ""}`}>
                              <input
                                value={settings.password ?? ""}
                                onChange={(event) => updateAdditional(id, { password: event.target.value })}
                                className="input"
                                type="password"
                                placeholder={info?.settings.hasPassword ? "Leave blank to keep current password" : "Password"}
                              />
                            </Field>
                          </>
                        ) : null}
                      </div>
                    </IntegrationSection>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-white/10 p-5">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save integrations"}
          </button>
        </div>
      </form>
    </div>
  );
}

function IntegrationSection({
  info,
  children,
  result,
  testing,
  onTest,
  onRemove,
  actionDisabled
}: {
  info?: IntegrationInfo;
  children: React.ReactNode;
  result?: IntegrationTestResult;
  testing: boolean;
  onTest: () => void;
  onRemove: () => void;
  actionDisabled: boolean;
}) {
  const Icon = info ? icons[info.id] : Boxes;
  const canRemove = Boolean(
    info?.settings.baseUrl ||
      info?.settings.socketPath ||
      info?.settings.controlUrl ||
      info?.settings.containerName ||
      info?.settings.expectedHostIp ||
      (Array.isArray(info?.settings.sources) && info.settings.sources.length > 0) ||
      (Array.isArray(info?.settings.channels) && info.settings.channels.length > 0) ||
      info?.settings.hasToken ||
      info?.settings.hasUsername ||
      info?.settings.hasPassword ||
      info?.settings.hasApiKey
  );
  const displayStatus = result && !result.ok ? "failing" : info?.status;

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-amber-100">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-50">{info?.name ?? "Integration"}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">{info?.summary}</p>
          </div>
        </div>
        {info ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[displayStatus ?? "available"]}`}>
              {(displayStatus ?? "available").replace("_", " ")}
            </span>
            <button
              type="button"
              onClick={onTest}
              disabled={actionDisabled}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-cyan-300/20 px-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
              Test
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={!canRemove || testing}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-rose-300/20 px-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        ) : null}
      </div>
      {result ? (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            result.ok
              ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
              : "border-rose-300/20 bg-rose-500/10 text-rose-100"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <span className="font-semibold">{result.ok ? "Connection online" : "Connection failed"}</span>
            <span className="text-xs opacity-75">{result.status} · {result.durationMs} ms</span>
          </div>
          {result.error ? <p className="mt-2 leading-5 opacity-90">{result.error}</p> : null}
          {!result.configured ? <p className="mt-2 leading-5 opacity-90">Save the required settings before testing this integration.</p> : null}
        </div>
      ) : null}
      {children}
      {info?.instructions.length ? (
        <ul className="mt-4 space-y-1 text-xs leading-5 text-slate-500">
          {info.instructions.map((instruction) => (
            <li key={instruction}>{instruction}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}
