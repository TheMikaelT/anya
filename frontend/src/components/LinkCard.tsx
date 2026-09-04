import {
  Activity,
  Bot,
  BookOpen,
  Cloud,
  Container,
  Database,
  Download,
  Film,
  Home,
  LayoutDashboard,
  MoveRight,
  Network,
  Server,
  Workflow
} from "lucide-react";
import type { DashboardLink } from "../types";

interface LinkCardProps {
  link: DashboardLink;
}

const icons = {
  activity: Activity,
  bot: Bot,
  "book-open": BookOpen,
  cloud: Cloud,
  "layout-dashboard": LayoutDashboard,
  database: Database,
  download: Download,
  film: Film,
  home: Home,
  container: Container,
  network: Network,
  server: Server,
  workflow: Workflow
};

export default function LinkCard({ link }: LinkCardProps) {
  const Icon = icons[link.icon as keyof typeof icons] ?? Server;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      title={`${link.name} - ${link.url}`}
      className="group relative flex min-h-16 overflow-hidden rounded-lg border border-white/10 bg-[#24303a]/82 shadow-[0_10px_22px_rgba(10,15,22,0.16)] transition hover:-translate-y-0.5 hover:border-amber-300/45 hover:bg-[#2d3b47]"
      aria-label={`Open ${link.name}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 pr-11">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-100/12 bg-cyan-100/[0.06] text-cyan-100 transition group-hover:border-amber-200/35 group-hover:bg-amber-200/[0.08] group-hover:text-amber-100">
          {link.iconUrl ? (
            <img src={link.iconUrl} alt="" className="h-7 w-7 object-contain" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>
        <h3 className="min-w-0 overflow-hidden break-words text-sm font-semibold leading-tight text-slate-50 transition [overflow-wrap:anywhere] group-hover:text-white sm:text-base">
          {link.name}
        </h3>
      </div>
      <div className="absolute inset-y-0 right-0 flex w-9 items-center justify-center border-l border-white/10 bg-black/10 text-slate-300 transition group-hover:bg-amber-300/18 group-hover:text-amber-100">
        <MoveRight className="h-4 w-4" />
      </div>
    </a>
  );
}
