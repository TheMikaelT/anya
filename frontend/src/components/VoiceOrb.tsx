import type React from "react";

export type VoiceOrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface VoiceOrbProps {
  state: VoiceOrbState;
  activity?: number;
  label?: string;
  size?: "sm" | "md";
}

const stateClass: Record<VoiceOrbState, string> = {
  idle: "voice-orb-idle",
  listening: "voice-orb-listening",
  thinking: "voice-orb-thinking",
  speaking: "voice-orb-speaking",
  error: "voice-orb-error"
};

function ringPath(ringIndex: number) {
  const points: string[] = [];
  const baseRadius = 18 + ringIndex * 2.35;
  const amplitude = 1.4 + ringIndex * 0.16;
  const wobble = 0.8 + ringIndex * 0.11;

  for (let index = 0; index <= 120; index += 1) {
    const angle = (Math.PI * 2 * index) / 120;
    const wave =
      Math.sin(angle * 5 + ringIndex * 0.9) * amplitude +
      Math.cos(angle * 9 - ringIndex * 0.45) * wobble +
      Math.sin(angle * 2 + ringIndex * 1.7) * 0.65;
    const radius = baseRadius + wave;
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return points.join(" ");
}

function dotPosition(index: number, count: number) {
  const angle = (Math.PI * 2 * index) / count;
  const radius = 40 + Math.sin(angle * 7) * 2.4;

  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius
  };
}

export default function VoiceOrb({ state, activity = 0, label = "Anya voice state", size = "md" }: VoiceOrbProps) {
  const dimension = size === "sm" ? "h-14 w-14" : "h-24 w-24";
  const ringCount = size === "sm" ? 9 : 13;
  const dotCount = size === "sm" ? 36 : 56;
  const gradientId = `voice-orb-gradient-${size}`;
  const glowId = `voice-orb-glow-${size}`;
  const normalizedActivity = Math.max(0, Math.min(1, activity));
  const style = {
    "--voice-activity": normalizedActivity.toFixed(2),
    "--voice-scale": (0.94 + normalizedActivity * 0.12).toFixed(3),
    "--voice-opacity": (0.46 + normalizedActivity * 0.48).toFixed(3)
  } as React.CSSProperties;

  return (
    <div
      className={`voice-orb ${stateClass[state]} relative flex shrink-0 items-center justify-center ${dimension}`}
      style={style}
      role="img"
      aria-label={label}
    >
      <svg className="voice-orb-svg h-full w-full overflow-visible" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="10%" y1="18%" x2="90%" y2="84%">
            <stop offset="0%" stopColor="#0ea5ff" />
            <stop offset="38%" stopColor="#38bdf8" />
            <stop offset="64%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ff2bd6" />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="52%" r="55%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.34" />
            <stop offset="54%" stopColor="#2563eb" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="38" fill={`url(#${glowId})`} />
        <g className="voice-orb-dots">
          {Array.from({ length: dotCount }).map((_, index) => {
            const point = dotPosition(index, dotCount);
            return (
              <circle
                key={index}
                cx={point.x.toFixed(2)}
                cy={point.y.toFixed(2)}
                r={index % 5 === 0 ? 0.55 : 0.38}
                fill={`url(#${gradientId})`}
                opacity={0.18 + (index % 7) * 0.055}
              />
            );
          })}
        </g>
        <g className="voice-orb-mesh">
          {Array.from({ length: ringCount }).map((_, index) => (
            <polyline
              key={index}
              className="voice-orb-ring"
              points={ringPath(index)}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={size === "sm" ? 0.52 : 0.42}
              opacity={0.2 + index * 0.045}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <circle className="voice-orb-core" cx="50" cy="50" r="4.2" fill="#f8fafc" opacity="0.18" />
      </svg>
    </div>
  );
}
