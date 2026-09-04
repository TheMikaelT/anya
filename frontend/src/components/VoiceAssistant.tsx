import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { requestAssistantSpeech, streamAssistantAnswer } from "../api";
import VoiceOrb, { type VoiceOrbState } from "./VoiceOrb";

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognitionEventResult {
  transcript: string;
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<ArrayLike<SpeechRecognitionEventResult>>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function splitForSpeech(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function extractSpeakableParts(text: string, force = false) {
  const normalized = text.replace(/\s+/g, " ").trimStart();
  const sentenceMatches = normalized.match(/.*?[.!?](?:\s|$)/gs) ?? [];
  const readySource = sentenceMatches.join("");
  const ready = readySource
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (ready.length) {
    return {
      ready,
      rest: normalized.slice(readySource.length)
    };
  }

  if (force && normalized.trim()) {
    return {
      ready: [normalized.trim()],
      rest: ""
    };
  }

  return {
    ready: [],
    rest: normalized
  };
}

function selectVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang.toLowerCase() === "fi-fi" && /satu|premium|enhanced/i.test(voice.name)) ??
    voices.find((voice) => voice.lang.toLowerCase() === "fi-fi") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("fi")) ??
    null
  );
}

function voiceLabel(state: VoiceOrbState) {
  if (state === "listening") return "Listening";
  if (state === "thinking") return "Thinking";
  if (state === "speaking") return "Speaking";
  if (state === "error") return "Voice unavailable";
  return "Ready";
}

function createBrowserId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getVoiceSessionId() {
  if (typeof window === "undefined") {
    return "voice-server";
  }

  const existing = window.localStorage.getItem("anya.voice.session");
  if (existing) {
    return existing;
  }

  const next = createBrowserId();
  window.localStorage.setItem("anya.voice.session", next);
  return next;
}

export default function VoiceAssistant() {
  const [state, setState] = useState<VoiceOrbState>("idle");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [orbActivity, setOrbActivity] = useState(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const speakingRef = useRef(false);
  const speechQueueRef = useRef<string[]>([]);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const activityTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef(getVoiceSessionId());

  const recognitionSupported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      voiceRef.current = selectVoice();
    };

    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);

    return () => {
      if (activityTimerRef.current) {
        window.clearTimeout(activityTimerRef.current);
      }
      recognitionRef.current?.abort();
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  function pulseOrb(amount = 1) {
    setOrbActivity(amount);
    if (activityTimerRef.current) {
      window.clearTimeout(activityTimerRef.current);
    }
    activityTimerRef.current = window.setTimeout(() => setOrbActivity(0.12), 360);
  }

  function stopSpeech() {
    speakingRef.current = false;
    speechQueueRef.current = [];
    currentUtteranceRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
    setOrbActivity(0);
    setState("idle");
  }

  async function playNaturalSpeech(text: string) {
    if (muted) {
      return false;
    }

    try {
      const url = await requestAssistantSpeech(text);
      if (!url) {
        return false;
      }

      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      speakingRef.current = true;
      setState("speaking");
      pulseOrb(1);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        speakingRef.current = false;
        audioRef.current = null;
        setState("idle");
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        speakingRef.current = false;
        audioRef.current = null;
        queueSpeech(text);
      };
      audio.ontimeupdate = () => {
        if (!audio.paused && !audio.ended) {
          pulseOrb(0.52 + Math.random() * 0.18);
        }
      };
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  function speakQueued() {
    if (!speakingRef.current || muted || typeof window === "undefined" || !window.speechSynthesis || currentUtteranceRef.current) {
      return;
    }

    const next = speechQueueRef.current.shift();

    if (!next) {
      return;
    }

    setState("speaking");
    pulseOrb(0.95);
    const utterance = new SpeechSynthesisUtterance(next);
    utterance.lang = "fi-FI";
    utterance.voice = voiceRef.current;
    utterance.rate = 0.92;
    utterance.pitch = 0.98;
    utterance.onboundary = () => {
      pulseOrb(0.55 + Math.random() * 0.35);
    };
    utterance.onend = () => {
      currentUtteranceRef.current = null;
      if (speechQueueRef.current.length) {
        speakQueued();
      } else {
        speakingRef.current = false;
        setState("idle");
      }
    };
    utterance.onerror = () => {
      currentUtteranceRef.current = null;
      if (speechQueueRef.current.length) {
        speakQueued();
      } else {
        speakingRef.current = false;
        setState("idle");
      }
    };
    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  function queueSpeech(text: string) {
    if (muted || typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    const parts = splitForSpeech(text);
    if (!parts.length) {
      return;
    }

    speakingRef.current = true;
    speechQueueRef.current.push(...parts);
    speakQueued();
  }

  async function ask(question: string) {
    const trimmed = question.trim();

    if (!trimmed) {
      setState("idle");
      return;
    }

    setError(null);
    setAnswer("");
    setState("thinking");
    pulseOrb(0.28);
    speechQueueRef.current = [];
    currentUtteranceRef.current = null;
    window.speechSynthesis?.cancel();
    let streamedAnswer = "";
    let speechBuffer = "";
    let spokenStarted = false;

    try {
      await streamAssistantAnswer(
        trimmed,
        (chunk) => {
          streamedAnswer += chunk;
          speechBuffer += chunk;
          setAnswer(streamedAnswer);
          pulseOrb(0.75);

          const { ready, rest } = extractSpeakableParts(speechBuffer);
          if (!ready.length) {
            return;
          }

          speechBuffer = rest;
          spokenStarted = true;
          queueSpeech(ready.join(" "));
        },
        () => {
          const { ready } = extractSpeakableParts(speechBuffer, true);
          const tail = ready.join(" ").trim();

          if (tail) {
            if (!spokenStarted && streamedAnswer.length <= 420) {
              void playNaturalSpeech(streamedAnswer).then((played) => {
                if (!played) {
                  queueSpeech(tail);
                }
              });
            } else {
              queueSpeech(tail);
            }
          }
        },
        sessionIdRef.current
      );

      if (!speechQueueRef.current.length && !currentUtteranceRef.current && !audioRef.current) {
        speakingRef.current = false;
        setState("idle");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice assistant request failed");
      setState("error");
    }
  }

  function startListening() {
    if (!recognitionSupported) {
      setError("Voice recognition is not available in this browser.");
      setState("error");
      return;
    }

    stopSpeech();
    setError(null);
    setAnswer("");
    setTranscript("");
    transcriptRef.current = "";
    pulseOrb(0.55);

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "fi-FI";
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      transcriptRef.current = text;
      setTranscript(text);
      pulseOrb(0.78);
    };

    recognition.onerror = (event) => {
      setError(event.error ? `Voice recognition failed: ${event.error}` : "Voice recognition failed");
      setState("error");
    };

    recognition.onend = () => {
      const spoken = transcriptRef.current.trim();
      recognitionRef.current = null;
      if (spoken) {
        void ask(spoken);
      } else {
        setState((current) => (current === "listening" ? "idle" : current));
      }
    };

    setState("listening");
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  const active = state === "listening" || state === "thinking" || state === "speaking";

  return (
    <section className="voice-assistant mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-2.5 text-left backdrop-blur sm:gap-3 sm:p-3">
      <VoiceOrb state={state} activity={orbActivity} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-300 sm:text-xs">Anya Voice</p>
          <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.55)]" : "bg-slate-500"}`} />
          <p className="text-xs text-slate-500">{voiceLabel(state)}</p>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-slate-400 sm:text-sm">
          {error || answer || transcript || "Tap mic, ask Anya, and the answer is spoken back."}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setMuted((current) => !current)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] text-slate-300 transition hover:border-amber-200/30 hover:text-amber-100 sm:h-10 sm:w-10"
          title={muted ? "Enable spoken answers" : "Mute spoken answers"}
          aria-label={muted ? "Enable spoken answers" : "Mute spoken answers"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={state === "listening" ? stopListening : state === "speaking" ? stopSpeech : startListening}
          disabled={state === "thinking"}
          className="flex h-9 min-w-9 items-center justify-center gap-2 rounded-lg border border-amber-200/25 bg-amber-300/90 px-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:min-w-10"
        >
          {state === "listening" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          <span className="hidden sm:inline">{state === "listening" ? "Stop" : state === "speaking" ? "Stop" : "Talk"}</span>
        </button>
      </div>
    </section>
  );
}
