import { ExternalLink, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface CommandPaletteCommand {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  disabled?: boolean;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  commands: CommandPaletteCommand[];
  onClose: () => void;
}

function commandMatches(command: CommandPaletteCommand, query: string) {
  const target = [command.label, command.description, ...(command.keywords ?? [])].join(" ").toLowerCase();
  return target.includes(query.toLowerCase());
}

export default function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filteredCommands = useMemo(() => {
    const cleaned = query.trim();

    if (!cleaned) {
      return commands;
    }

    return commands.filter((command) => commandMatches(command, cleaned));
  }, [commands, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
      return;
    }

    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  function runSelectedCommand() {
    const command = filteredCommands[selectedIndex];

    if (!command || command.disabled) {
      return;
    }

    command.run();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="mx-auto mt-20 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/12 bg-[#1d2832]/95 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((current) => Math.min(current + 1, Math.max(0, filteredCommands.length - 1)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((current) => Math.max(0, current - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                runSelectedCommand();
              }
            }}
            placeholder="Search commands..."
            className="min-w-0 flex-1 bg-transparent text-base text-slate-100 outline-none placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-amber-200/30 hover:text-amber-100"
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredCommands.length ? (
            filteredCommands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                disabled={command.disabled}
                onClick={() => {
                  if (command.disabled) {
                    return;
                  }

                  command.run();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                  index === selectedIndex ? "bg-amber-200/10 text-amber-50" : "text-slate-200 hover:bg-white/[0.06]"
                } ${command.disabled ? "cursor-not-allowed opacity-45" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{command.label}</span>
                  {command.description ? <span className="block truncate text-xs text-slate-500">{command.description}</span> : null}
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-slate-500" />
              </button>
            ))
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">No commands found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
