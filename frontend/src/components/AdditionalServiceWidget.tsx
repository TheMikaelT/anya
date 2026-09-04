import { Loader2, Play, Power, Search, Server, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { AdditionalIntegrationId, HomeAssistantControlOption, ServiceIntegrationData } from "../types";
import WidgetCard from "./WidgetCard";
import { useWidgetDisplay } from "./WidgetDisplayContext";

interface AdditionalServiceWidgetProps {
  serviceId: AdditionalIntegrationId;
  title: string;
  refreshKey?: number;
}

export default function AdditionalServiceWidget({ serviceId, title, refreshKey = 0 }: AdditionalServiceWidgetProps) {
  const [service, setService] = useState<ServiceIntegrationData | null>(null);
  const [busyEntity, setBusyEntity] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);
  const dense = useWidgetDisplay() === "dense";

  useEffect(() => {
    let active = true;

    function load() {
      api
        .servicesStatus()
        .then((data) => {
          if (active) {
            setService(data.services.find((item) => item.id === serviceId) ?? null);
          }
        })
        .catch(() => {
          if (active) {
            setService(null);
          }
        });
    }

    load();
    const timer = window.setInterval(load, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [localRefresh, refreshKey, serviceId]);

  const status = service?.status ?? "unknown";
  const metrics = service?.metrics ?? [];
  const controls = service?.controls ?? [];

  async function handleAction(entityId: string) {
    setBusyEntity(entityId);
    setActionError(null);

    try {
      const nextService = await api.serviceAction(serviceId, entityId);
      setService(nextService);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyEntity(null);
    }
  }

  return (
    <>
    <WidgetCard
      title={title}
      icon={<Server className="h-5 w-5" />}
      status={status}
      action={serviceId === "homeassistant" ? (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="rounded-lg border border-white/10 bg-white/[0.035] p-1.5 text-slate-400 transition hover:border-amber-200/35 hover:text-amber-100"
          title="Customize Home Assistant widget"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      ) : undefined}
    >
      {!service ? (
        <p className="text-sm text-slate-500">Loading service status...</p>
      ) : service.configured ? (
        <div className="space-y-3">
          {metrics.length ? (
            <div className={`grid gap-2 ${dense ? "grid-cols-2" : "grid-cols-3"}`}>
              {metrics.slice(0, dense ? 4 : 6).map((metric) => (
                <div key={metric.label} className="rounded-lg border border-white/5 bg-white/[0.03] p-2">
                  <p className="truncate text-base font-semibold text-slate-100">{metric.value}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{metric.label}</p>
                </div>
              ))}
            </div>
          ) : null}

          {service.details?.length ? (
            <div className="space-y-1">
              {service.details.slice(0, dense ? 2 : 3).map((detail) => (
                <p key={detail} className="truncate rounded-lg bg-black/15 px-3 py-2 text-xs text-slate-400">
                  {detail}
                </p>
              ))}
            </div>
          ) : null}

          {controls.length || serviceId === "homeassistant" ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Controls</p>
              <div className="grid grid-cols-2 gap-2">
                {controls.slice(0, 6).map((control) => {
                  const isBusy = busyEntity === control.entityId;
                  const Icon = control.action === "turn_on" ? Play : Power;

                  return (
                    <button
                      key={control.entityId}
                      type="button"
                      onClick={() => void handleAction(control.entityId)}
                      disabled={Boolean(busyEntity)}
                      className="flex min-h-16 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-left text-xs text-slate-300 transition hover:border-cyan-200/40 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                      title={control.entityId}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-200">{control.label}</span>
                        <span className="block truncate text-slate-500">{control.domain} · {control.state}</span>
                      </span>
                      {isBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Icon className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}
                {serviceId === "homeassistant" && controls.length < 6 ? (
                  Array.from({ length: 6 - controls.length }).map((_, index) => (
                    <button
                      key={`empty-control-${index}`}
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="flex min-h-16 items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/10 px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-amber-200/35 hover:text-amber-100"
                    >
                      Add control
                    </button>
                  ))
                ) : null}
              </div>
            </div>
          ) : null}

          {service.error ? <p className="text-xs leading-5 text-rose-300">{service.error}</p> : null}
          {actionError ? <p className="text-xs leading-5 text-rose-300">{actionError}</p> : null}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
          Configure {title} in Integrations, then enable it for live status.
        </div>
      )}
    </WidgetCard>
    {settingsOpen ? (
      <HomeAssistantWidgetSettings
        onClose={() => setSettingsOpen(false)}
        onSaved={() => {
          setSettingsOpen(false);
          setLocalRefresh((value) => value + 1);
        }}
      />
    ) : null}
    </>
  );
}

function HomeAssistantWidgetSettings({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [options, setOptions] = useState<HomeAssistantControlOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [showMetrics, setShowMetrics] = useState(true);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    api.homeAssistantOptions()
      .then((data) => {
        if (!active) return;
        setOptions(data.options);
        setSelected(data.selected);
        setShowMetrics(data.showMetrics);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load Home Assistant entities");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options
    .filter((option) => {
      if (!normalizedQuery) return true;
      return [option.label, option.entityId, option.domain].some((value) => value.toLowerCase().includes(normalizedQuery));
    })
    .slice(0, 80);
  const selectedOptions = selected
    .map((entityId) => options.find((option) => option.entityId === entityId) ?? {
      entityId,
      label: entityId,
      domain: entityId.split(".")[0] ?? "entity",
      state: "unknown"
    });

  function toggleSelected(entityId: string) {
    setSelected((current) => {
      if (current.includes(entityId)) {
        return current.filter((item) => item !== entityId);
      }

      if (current.length >= 6) {
        return current;
      }

      return [...current, entityId];
    });
  }

  async function saveSettings() {
    setSaving(true);
    setError(null);

    try {
      await api.updateIntegrations({
        additional: {
          homeassistant: {
            controlEntityIds: selected,
            showMetrics
          }
        }
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Home Assistant widget settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[min(44rem,calc(100vh-2rem))] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#202a33] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-100">Home Assistant controls</h3>
            <p className="mt-1 text-xs text-slate-500">Choose up to 6 buttons for a 3x2 widget grid.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/[0.035] p-2 text-slate-400 transition hover:text-slate-100"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid max-h-[calc(100vh-10rem)] gap-4 overflow-y-auto p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-200">
              <span>
                <span className="block font-medium">Show metric tiles</span>
                <span className="block text-xs text-slate-500">Entities, unavailable, lights on and similar counts.</span>
              </span>
              <input
                type="checkbox"
                checked={showMetrics}
                onChange={(event) => setShowMetrics(event.target.checked)}
                className="h-4 w-4 accent-amber-300"
              />
            </label>

            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Selected</p>
                <p className="text-xs text-slate-500">{selected.length}/6</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {selectedOptions.map((option) => (
                  <button
                    key={option.entityId}
                    type="button"
                    onClick={() => toggleSelected(option.entityId)}
                    className="min-h-16 rounded-lg border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-left text-xs text-amber-50"
                    title={option.entityId}
                  >
                    <span className="block truncate font-medium">{option.label}</span>
                    <span className="block truncate text-amber-100/60">{option.domain} · {option.state}</span>
                  </button>
                ))}
                {!selected.length ? (
                  <p className="col-span-2 rounded-lg border border-dashed border-white/10 px-3 py-5 text-center text-xs text-slate-500">
                    No custom buttons selected.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0f1623] px-3 py-2 text-slate-300">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search lights, switches, automations..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-xs leading-5 text-rose-100">{error}</div>
            ) : null}

            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {loading ? <p className="text-sm text-slate-500">Loading entities...</p> : null}
              {!loading && filteredOptions.map((option) => {
                const isSelected = selected.includes(option.entityId);
                const isDisabled = !isSelected && selected.length >= 6;

                return (
                  <button
                    key={option.entityId}
                    type="button"
                    onClick={() => toggleSelected(option.entityId)}
                    disabled={isDisabled}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${
                      isSelected
                        ? "border-amber-200/35 bg-amber-200/10 text-amber-50"
                        : "border-white/10 bg-white/[0.025] text-slate-300 hover:border-cyan-200/30"
                    }`}
                    title={option.entityId}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{option.label}</span>
                      <span className="block truncate text-xs text-slate-500">{option.entityId}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-black/20 px-2 py-1 text-[0.68rem] uppercase tracking-[0.08em] text-slate-400">
                      {option.domain}
                    </span>
                  </button>
                );
              })}
              {!loading && !filteredOptions.length ? <p className="text-sm text-slate-500">No matching entities.</p> : null}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
