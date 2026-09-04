import { Bot, Expand, Send, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api";
import WidgetCard from "./WidgetCard";
import { useWidgetDisplay } from "./WidgetDisplayContext";

const suggestions = [
  "Mikä Anyassa vaatii huomiota?",
  "Onko VPN kunnossa?",
  "Mitä Dockerissa on pysähtynyt?",
  "Miksi qBittorrent ei lataa?"
];

interface AssistantWidgetProps {
  refreshKey?: number;
}

export default function AssistantWidget({ refreshKey: _refreshKey = 0 }: AssistantWidgetProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [meta, setMeta] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);
  const dense = useWidgetDisplay() === "dense";

  async function ask(nextQuestion = question) {
    const trimmed = nextQuestion.trim();

    if (!trimmed || thinking) {
      return;
    }

    setThinking(true);
    setError(null);
    setAnswer("");
    setMeta("");
    setSources([]);
    setAnswerOpen(false);

    try {
      const response = await api.askAssistant(trimmed);
      setAnswer(response.response);
      setSources(response.sources);
      setMeta([
        response.model,
        response.tokens ? `${response.tokens} tokens` : "",
        response.durationMs ? `${(response.durationMs / 1000).toFixed(1)}s` : ""
      ].filter(Boolean).join(" · "));
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assistant request failed");
    } finally {
      setThinking(false);
    }
  }

  return (
    <WidgetCard title="Anya Assistant" icon={<Bot className="h-5 w-5" />} status={error ? "offline" : "online"}>
      {error ? (
        <div className="mb-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-xs leading-5 text-rose-100">
          {error}
        </div>
      ) : null}

      <div className={`mb-3 flex h-10 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.025] transition ${thinking ? "opacity-100" : "opacity-45"}`}>
        {Array.from({ length: 7 }).map((_, index) => (
          <span
            key={index}
            className={`w-1 rounded-full bg-cyan-200/80 ${thinking ? "animate-pulse" : ""}`}
            style={{
              height: thinking ? `${12 + ((index * 5) % 18)}px` : `${7 + ((index * 4) % 9)}px`,
              animationDelay: `${index * 80}ms`,
              animationDuration: `${620 + index * 55}ms`
            }}
          />
        ))}
      </div>

      <div className="space-y-3">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void ask();
            }
          }}
          disabled={thinking}
          className={`input ${dense ? "min-h-16" : "min-h-24"} resize-y text-sm leading-6`}
          placeholder="Ask Anya about this homelab..."
        />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={!question.trim() || thinking}
          className="inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {thinking ? "Checking..." : "Ask Anya"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => void ask(suggestion)}
            disabled={thinking}
            className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-left font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {answer ? (
        <div className="mt-4 rounded-lg border border-cyan-200/15 bg-cyan-300/5 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            {meta ? <p>{meta}</p> : <span />}
            {sources.length ? <p>{sources.length} sources</p> : null}
          </div>
          <p className="max-h-14 overflow-hidden whitespace-pre-wrap text-sm leading-6 text-slate-200">
            {answer}
          </p>
          <button
            type="button"
            onClick={() => setAnswerOpen(true)}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            <Expand className="h-3.5 w-3.5" />
            Open full answer
          </button>
        </div>
      ) : null}

      <AssistantAnswerModal
        open={answerOpen}
        answer={answer}
        meta={meta}
        sources={sources}
        onClose={() => setAnswerOpen(false)}
      />
    </WidgetCard>
  );
}

function AssistantAnswerModal({
  open,
  answer,
  meta,
  sources,
  onClose
}: {
  open: boolean;
  answer: string;
  meta: string;
  sources: string[];
  onClose: () => void;
}) {
  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end bg-black/70 p-4 backdrop-blur sm:items-center sm:justify-center">
      <section className="flex max-h-[86vh] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-deck-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-100/80">Anya Assistant</p>
            <h2 className="text-xl font-semibold text-white">Homelab answer</h2>
            {meta ? <p className="mt-1 text-xs text-slate-500">{meta}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close assistant answer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{answer}</p>
          {sources.length ? (
            <p className="mt-5 text-xs uppercase tracking-[0.18em] text-slate-500">
              Sources: {sources.join(", ")}
            </p>
          ) : null}
        </div>
      </section>
    </div>,
    document.body
  );
}
