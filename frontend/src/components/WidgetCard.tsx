import type { ReactNode } from "react";
import { useWidgetDisplay } from "./WidgetDisplayContext";

type Status = "online" | "offline" | "unknown";

interface WidgetCardProps {
  title: string;
  icon?: ReactNode;
  status?: Status;
  action?: ReactNode;
  children: ReactNode;
}

const statusStyles: Record<Status, string> = {
  online: "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.55)]",
  offline: "bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.45)]",
  unknown: "bg-slate-500"
};

export default function WidgetCard({ title, icon, status = "unknown", action, children }: WidgetCardProps) {
  const widgetStyle = useWidgetDisplay();

  if (widgetStyle === "compact") {
    return (
      <section
        tabIndex={0}
        className="group relative h-full min-h-28 rounded-xl border border-white/[0.07] bg-[#22303a]/48 p-3 outline-none backdrop-blur-sm transition hover:z-40 hover:border-amber-200/25 hover:bg-[#283845]/90 focus:z-40 focus:border-amber-200/25 focus:bg-[#283845]/90"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {icon ? <div className="text-amber-100/85">{icon}</div> : null}
            <h2 className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-slate-100">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <span className="flex items-center gap-1.5 text-[0.68rem] capitalize text-slate-500">
              <span className={`h-2 w-2 rounded-full ${statusStyles[status]}`} />
              {status}
            </span>
          </div>
        </div>
        <div className="mt-5 text-xs text-slate-500">Details on hover</div>
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 hidden w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-[#1f2b35]/95 p-4 shadow-2xl backdrop-blur-xl group-hover:block group-focus:block group-focus-within:block">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {icon ? <div className="text-amber-100">{icon}</div> : null}
              <h3 className="truncate text-sm font-semibold uppercase tracking-[0.16em] text-slate-100">{title}</h3>
            </div>
            <div className="flex items-center gap-2">
              {action}
              <span className="flex items-center gap-2 text-xs capitalize text-slate-400">
                <span className={`h-2.5 w-2.5 rounded-full ${statusStyles[status]}`} />
                {status}
              </span>
            </div>
          </div>
          {children}
        </div>
      </section>
    );
  }

  return (
    <section
      className={
        widgetStyle === "dense"
          ? "widget-card h-full min-w-0 overflow-hidden rounded-xl border border-white/[0.075] bg-[#22303a]/50 p-3 backdrop-blur-sm"
          : "widget-card h-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#26323d]/76 p-4 shadow-glow backdrop-blur"
      }
    >
      <div className={`${widgetStyle === "dense" ? "mb-3" : "mb-4"} flex items-center justify-between gap-3`}>
        <div className="flex min-w-0 items-center gap-3">
          {icon ? <div className="text-amber-100">{icon}</div> : null}
          <h2 className={`${widgetStyle === "dense" ? "text-xs tracking-[0.14em]" : "text-sm tracking-[0.16em]"} truncate font-semibold uppercase text-slate-100`}>{title}</h2>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {action}
          <span className="flex min-w-0 items-center gap-2 text-xs capitalize text-slate-400">
            <span className={`h-2.5 w-2.5 rounded-full ${statusStyles[status]}`} />
            <span className="hidden sm:inline">{status}</span>
          </span>
        </div>
      </div>
      {children}
    </section>
  );
}
