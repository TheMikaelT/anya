import { Bot, Expand, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api";
import type { OllamaData, OllamaMessage } from "../types";
import WidgetCard from "./WidgetCard";
import { useWidgetDisplay } from "./WidgetDisplayContext";

interface OllamaWidgetProps {
  refreshKey?: number;
  onThinkingChange?: (thinking: boolean) => void;
}

export default function OllamaWidget({ refreshKey = 0, onThinkingChange }: OllamaWidgetProps) {
  const [data, setData] = useState<OllamaData | null>(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [answer, setAnswer] = useState("");
  const [meta, setMeta] = useState("");
  const [conversation, setConversation] = useState<OllamaMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);
  const dense = useWidgetDisplay() === "dense";

  useEffect(() => {
    let active = true;

    api
      .ollama()
      .then((nextData) => {
        if (!active) {
          return;
        }

        setData(nextData);
        setModel((current) => current || nextData.model || nextData.models[0] || "");
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    onThinkingChange?.(thinking);
  }, [onThinkingChange, thinking]);

  useEffect(() => {
    return () => onThinkingChange?.(false);
  }, [onThinkingChange]);

  async function ask() {
    const trimmed = prompt.trim();

    if (!trimmed || thinking) {
      return;
    }

    setThinking(true);
    setError(null);
    setAnswer("");
    setMeta("");
    setAnswerOpen(false);

    try {
      const nextMessages = [...conversation, { role: "user" as const, content: trimmed }].slice(-15);
      const response = await api.askOllama(trimmed, model, nextMessages);
      const assistantMessage = { role: "assistant" as const, content: response.response };
      setAnswer(response.response);
      setModel(response.model);
      setConversation([...nextMessages, assistantMessage].slice(-16));
      setMeta([
        response.model,
        response.tokens ? `${response.tokens} tokens` : "",
        response.durationMs ? `${(response.durationMs / 1000).toFixed(1)}s` : ""
      ].filter(Boolean).join(" · "));
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ollama request failed");
    } finally {
      setThinking(false);
    }
  }

  function startNewChat() {
    setConversation([]);
    setAnswer("");
    setMeta("");
    setError(null);
    setAnswerOpen(false);
  }

  return (
    <WidgetCard title="Ollama" icon={<Bot className="h-5 w-5" />} status={data?.status ?? "unknown"}>
      {!data?.configured ? (
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
          Configure Ollama in Manage &gt; Integrations.
        </div>
      ) : null}

      {error || data?.error ? (
        <div className="mb-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-xs leading-5 text-rose-100">
          {error ?? data?.error}
        </div>
      ) : null}

      <OllamaWave active={thinking} />

      <div className="space-y-3">
        <select
          value={model}
          onChange={(event) => setModel(event.target.value)}
          className="input h-10 text-sm"
          disabled={!data?.configured || thinking}
        >
          {model && !data?.models.includes(model) ? <option value={model}>{model}</option> : null}
          {(data?.models ?? []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void ask();
            }
          }}
          disabled={!data?.configured || thinking}
          className={`input ${dense ? "min-h-16" : "min-h-24"} resize-y text-sm leading-6`}
          placeholder="Ask your local model..."
        />
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <button
            type="button"
            onClick={() => void ask()}
            disabled={!data?.configured || !prompt.trim() || !model || thinking}
            className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg bg-amber-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {thinking ? "Generating..." : conversation.length ? "Ask follow-up" : "Ask Ollama"}
          </button>
          <button
            type="button"
            onClick={startNewChat}
            disabled={thinking || (!conversation.length && !answer)}
            className="inline-flex h-10 min-w-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            New chat
          </button>
        </div>
      </div>

      <div className={`${dense ? "mt-3" : "mt-4"} grid min-w-0 grid-cols-1 gap-2 text-xs sm:grid-cols-2`}>
        <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
          <p className="truncate font-semibold text-slate-200">{model || data?.model || "-"}</p>
          <p className="mt-1 text-slate-500">Selected model</p>
        </div>
        <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
          <p className="font-semibold text-slate-200">{data?.models.length ?? 0}</p>
          <p className="mt-1 text-slate-500">Local models</p>
        </div>
      </div>

      {answer ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/12 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            {meta ? <p>{meta}</p> : <span />}
            <p>{Math.ceil(conversation.length / 2)} turn{conversation.length === 2 ? "" : "s"}</p>
          </div>
          <p className="max-h-12 overflow-hidden whitespace-pre-wrap text-sm leading-6 text-slate-200">
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

      <OllamaAnswerModal open={answerOpen} answer={answer} meta={meta} onClose={() => setAnswerOpen(false)} />
    </WidgetCard>
  );
}

function OllamaAnswerModal({
  open,
  answer,
  meta,
  onClose
}: {
  open: boolean;
  answer: string;
  meta: string;
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
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-100/80">Ollama</p>
            <h2 className="text-xl font-semibold text-white">Full answer</h2>
            {meta ? <p className="mt-1 text-xs text-slate-500">{meta}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close full answer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{answer}</p>
        </div>
      </section>
    </div>,
    document.body
  );
}

function OllamaWave({ active }: { active: boolean }) {
  return (
    <div className={`mb-3 flex h-10 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.025] transition ${active ? "opacity-100" : "opacity-45"}`}>
      {Array.from({ length: 7 }).map((_, index) => (
        <span
          key={index}
          className={`w-1 rounded-full bg-amber-200/80 ${active ? "animate-pulse" : ""}`}
          style={{
            height: active ? `${12 + ((index * 7) % 20)}px` : `${8 + ((index * 3) % 10)}px`,
            animationDelay: `${index * 90}ms`,
            animationDuration: `${650 + index * 60}ms`
          }}
        />
      ))}
    </div>
  );
}
