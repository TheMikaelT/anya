import {
  DownloadCloud,
  LayoutDashboard,
  PanelsRightBottom,
  Plug,
  Plus,
  Palette,
  Radar,
  RefreshCw,
  RotateCcw,
  Rss,
  Search,
  Settings,
  SlidersHorizontal
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

export interface RailItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export type MobileDashboardView = "widgets" | "apps";

interface ManagementRailProps {
  busyAction: string | null;
  mode?: "management" | "apps";
  railItems?: RailItem[];
  activeItem?: string | null;
  mobileView?: MobileDashboardView;
  onRailItemSelect?: (id: string) => void;
  onMobileViewChange?: (view: MobileDashboardView) => void;
  onServices: () => void;
  onWidgets: () => void;
  onIntegrations: () => void;
  onRss: () => void;
  onSearch: () => void;
  onAppearance: () => void;
  onDockerImport: () => void;
  onHeimdallImport: () => void;
  onRefreshLibrary: () => void;
  onAddService: () => void;
}

export default function ManagementRail({
  busyAction,
  mode = "management",
  railItems = [],
  activeItem = null,
  mobileView = "widgets",
  onRailItemSelect,
  onMobileViewChange,
  onServices,
  onWidgets,
  onIntegrations,
  onRss,
  onSearch,
  onAppearance,
  onDockerImport,
  onHeimdallImport,
  onRefreshLibrary,
  onAddService
}: ManagementRailProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!settingsOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (settingsMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setSettingsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsOpen]);

  const runFromSettings = (action: () => void) => {
    action();
    setSettingsOpen(false);
  };
  const managementButtons = (showTooltips = true, closeAfterClick = false, mobileDock = false) => (
    <>
      <RailButton label="Services" showTooltip={showTooltips} mobileDock={mobileDock} runOnPointerDown={closeAfterClick} onClick={() => closeAfterClick ? runFromSettings(onServices) : onServices()} icon={<SlidersHorizontal className="h-5 w-5" />} />
      <RailButton label="Widgets" showTooltip={showTooltips} mobileDock={mobileDock} runOnPointerDown={closeAfterClick} onClick={() => closeAfterClick ? runFromSettings(onWidgets) : onWidgets()} icon={<PanelsRightBottom className="h-5 w-5" />} />
      <RailButton label="Integrations" showTooltip={showTooltips} mobileDock={mobileDock} runOnPointerDown={closeAfterClick} onClick={() => closeAfterClick ? runFromSettings(onIntegrations) : onIntegrations()} icon={<Plug className="h-5 w-5" />} />
      <RailButton label="RSS feeds" showTooltip={showTooltips} mobileDock={mobileDock} runOnPointerDown={closeAfterClick} onClick={() => closeAfterClick ? runFromSettings(onRss) : onRss()} icon={<Rss className="h-5 w-5" />} />
      <RailButton label="Search" showTooltip={showTooltips} mobileDock={mobileDock} runOnPointerDown={closeAfterClick} onClick={() => closeAfterClick ? runFromSettings(onSearch) : onSearch()} icon={<Search className="h-5 w-5" />} />
      <RailButton label="Appearance" showTooltip={showTooltips} mobileDock={mobileDock} runOnPointerDown={closeAfterClick} onClick={() => closeAfterClick ? runFromSettings(onAppearance) : onAppearance()} icon={<Palette className="h-5 w-5" />} />
      <RailButton
        label={busyAction === "library" ? "Refreshing library" : "Refresh library"}
        showTooltip={showTooltips}
        mobileDock={mobileDock}
        runOnPointerDown={closeAfterClick}
        onClick={() => closeAfterClick ? runFromSettings(onRefreshLibrary) : onRefreshLibrary()}
        disabled={busyAction !== null}
        icon={<RefreshCw className={`h-5 w-5 ${busyAction === "library" ? "animate-spin" : ""}`} />}
      />
      <RailButton
        label="Docker import"
        showTooltip={showTooltips}
        mobileDock={mobileDock}
        runOnPointerDown={closeAfterClick}
        onClick={() => closeAfterClick ? runFromSettings(onDockerImport) : onDockerImport()}
        disabled={busyAction !== null}
        icon={<Radar className="h-5 w-5" />}
      />
      <RailButton
        label="Heimdall import"
        showTooltip={showTooltips}
        mobileDock={mobileDock}
        runOnPointerDown={closeAfterClick}
        onClick={() => closeAfterClick ? runFromSettings(onHeimdallImport) : onHeimdallImport()}
        disabled={busyAction !== null}
        icon={<DownloadCloud className="h-5 w-5" />}
      />
    </>
  );
  const addButton = (showTooltip = true, closeAfterClick = false) => (
    <RailButton
      label="Add service"
      onClick={() => closeAfterClick ? runFromSettings(onAddService) : onAddService()}
      showTooltip={showTooltip}
      runOnPointerDown={closeAfterClick}
      accent
      icon={<Plus className="h-5 w-5" />}
    />
  );
  const reloadButton = (showTooltip = true, mobileDock = false) => (
    <RailButton
      label="Reload Anya"
      onClick={() => window.location.reload()}
      showTooltip={showTooltip}
      mobileDock={mobileDock}
      icon={<RotateCcw className="h-5 w-5" />}
    />
  );

  const railContentClass = "grid grid-cols-10 gap-1 lg:flex lg:w-full lg:flex-1 lg:grid-cols-none lg:flex-col lg:items-center lg:gap-2";
  return (
    <>
      {settingsOpen && onMobileViewChange ? (
        <div className="mobile-settings-scrim pointer-events-auto fixed inset-0 z-[120] lg:hidden" onPointerDown={() => setSettingsOpen(false)}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" />
          <div
            ref={settingsMenuRef}
            onPointerDown={(event) => event.stopPropagation()}
            className="mobile-settings-menu pointer-events-auto absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] z-[121] grid max-h-[min(62vh,28rem)] grid-cols-3 gap-3 overflow-y-auto overscroll-contain rounded-2xl border border-white/20 bg-[#111821]/96 p-4 shadow-2xl backdrop-blur-xl"
          >
            {managementButtons(false, true, true)}
            {reloadButton(false, true)}
          </div>
        </div>
      ) : null}

      <nav className="management-rail fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#1b2730]/88 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl lg:inset-x-auto lg:bottom-auto lg:left-0 lg:top-0 lg:flex lg:h-screen lg:w-20 lg:flex-col lg:items-center lg:border-r lg:border-t-0 lg:px-3 lg:py-4">
        {onMobileViewChange ? (
          <div className="flex w-full items-center justify-center gap-2 lg:hidden">
            <RailButton
              label="Widgets"
              onClick={() => onMobileViewChange?.("widgets")}
              active={mobileView === "widgets"}
              showTooltip={false}
              mobileDock
              icon={<PanelsRightBottom className="h-5 w-5" />}
            />
            <RailButton
              label="Apps"
              onClick={() => onMobileViewChange?.("apps")}
              active={mobileView === "apps"}
              showTooltip={false}
              mobileDock
              icon={<LayoutDashboard className="h-5 w-5" />}
            />
            <RailButton
              label="Settings"
              onClick={() => {
                setSettingsOpen((current) => !current);
              }}
              active={settingsOpen}
              showTooltip={false}
              mobileDock
              icon={<Settings className="h-5 w-5" />}
            />

            {addButton(false, true)}
          </div>
        ) : null}

        <div className={`${railContentClass} ${onMobileViewChange || mode === "apps" ? "hidden lg:flex" : ""}`}>
          {mode === "apps" ? (
            (railItems ?? []).slice(0, 12).map((item) => (
              <RailButton
                key={item.id}
                label={item.label}
                onClick={() => onRailItemSelect?.(item.id)}
                active={activeItem === item.id}
                mobileDock
                icon={item.icon}
              />
            ))
          ) : (
            managementButtons()
          )}
          <div className="hidden lg:block lg:flex-1" />
          {mode === "apps" ? (
            <div ref={settingsMenuRef} className="relative shrink-0">
              <RailButton
                label="Settings"
                onClick={() => setSettingsOpen((current) => !current)}
                active={settingsOpen}
                mobileDock
                icon={<Settings className="h-5 w-5" />}
              />
              {settingsOpen ? (
                <div
                  onPointerDown={(event) => event.stopPropagation()}
                  className="absolute bottom-0 left-[calc(100%+0.75rem)] z-50 grid w-72 grid-cols-3 gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#111821]/95 p-2 shadow-2xl backdrop-blur-xl"
                >
                  {managementButtons(false, true)}
                  {addButton(false, true)}
                </div>
              ) : null}
            </div>
          ) : (
            addButton()
          )}
        </div>
      </nav>
    </>
  );
}

interface RailButtonProps {
  label: string;
  icon: React.ReactNode;
  accent?: boolean;
  active?: boolean;
  disabled?: boolean;
  showTooltip?: boolean;
  mobileDock?: boolean;
  runOnPointerDown?: boolean;
  onClick: () => void;
}

function RailButton({ label, icon, accent = false, active = false, disabled = false, showTooltip = true, mobileDock = false, runOnPointerDown = false, onClick }: RailButtonProps) {
  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!runOnPointerDown || disabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onClick();
  };

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onClick={runOnPointerDown ? undefined : onClick}
      disabled={disabled}
      className={`rail-button group relative flex ${mobileDock ? "h-11 w-11 shrink-0" : "h-11 min-w-0"} items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 lg:h-12 lg:w-12 ${
        accent
          ? "bg-amber-300 text-slate-950 hover:bg-amber-200"
          : active
            ? "border border-cyan-200/35 bg-cyan-200/14 text-cyan-50 shadow-[0_0_22px_rgba(103,232,249,0.16)]"
            : "border border-white/10 bg-cyan-100/[0.035] text-slate-300 hover:border-cyan-200/25 hover:bg-cyan-100/[0.08] hover:text-cyan-100"
      }`}
      aria-label={label}
      title={label}
    >
      {icon}
      {showTooltip ? (
        <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#111821] px-2.5 py-1.5 text-xs font-semibold text-slate-100 opacity-0 shadow-xl transition group-hover:opacity-100 lg:block">
          {label}
        </span>
      ) : null}
    </button>
  );
}
