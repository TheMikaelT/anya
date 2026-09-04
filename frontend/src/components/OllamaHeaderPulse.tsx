export default function OllamaHeaderPulse({ active }: { active: boolean }) {
  if (!active) {
    return null;
  }

  return (
    <div className="mb-3 flex items-center justify-center" aria-label="Ollama is responding">
      <div className="flex h-12 w-40 items-center justify-center gap-1 rounded-full border border-amber-200/25 bg-amber-200/10 shadow-[0_0_36px_rgba(252,211,77,0.18)]">
        {Array.from({ length: 13 }).map((_, index) => (
          <span
            key={index}
            className="w-1 animate-pulse rounded-full bg-amber-100/85"
            style={{
              height: `${10 + ((index * 9) % 26)}px`,
              animationDelay: `${index * 55}ms`,
              animationDuration: `${520 + index * 35}ms`
            }}
          />
        ))}
      </div>
    </div>
  );
}
