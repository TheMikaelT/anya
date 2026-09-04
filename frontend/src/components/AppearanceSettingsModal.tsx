import { Image, Save, Upload, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import type { AppearancePresetId, AppearanceSettings } from "../types";

interface AppearanceSettingsModalProps {
  open: boolean;
  appearance: AppearanceSettings;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (settings: AppearanceSettings) => Promise<void>;
  onUpload: (file: File) => Promise<string>;
}

const presets: Array<{ id: AppearancePresetId; name: string; className: string }> = [
  {
    id: "aurora",
    name: "Aurora",
    className: "bg-[radial-gradient(circle_at_18%_12%,rgba(95,206,210,0.55),transparent_42%),radial-gradient(circle_at_82%_10%,rgba(232,188,99,0.38),transparent_36%),linear-gradient(145deg,#26313a,#121a22)]"
  },
  {
    id: "ember",
    name: "Ember",
    className: "bg-[radial-gradient(circle_at_82%_12%,rgba(245,158,11,0.52),transparent_38%),radial-gradient(circle_at_20%_24%,rgba(103,232,249,0.22),transparent_40%),linear-gradient(145deg,#2a2724,#141b22)]"
  },
  {
    id: "midnight",
    name: "Midnight",
    className: "bg-[radial-gradient(circle_at_28%_10%,rgba(125,211,252,0.28),transparent_34%),radial-gradient(circle_at_72%_20%,rgba(129,140,248,0.24),transparent_38%),linear-gradient(145deg,#1b2430,#0c121a)]"
  },
  {
    id: "forest",
    name: "Forest",
    className: "bg-[radial-gradient(circle_at_16%_18%,rgba(52,211,153,0.34),transparent_38%),radial-gradient(circle_at_84%_8%,rgba(250,204,21,0.22),transparent_34%),linear-gradient(145deg,#1f302c,#101820)]"
  }
];

const defaultAppearance: AppearanceSettings = {
  background: {
    mode: "default",
    preset: "aurora",
    dim: 45,
    blur: 0
  }
};

const defaultBackground = {
  mode: "default" as const,
  preset: "aurora" as const,
  dim: 45,
  blur: 0
};

export default function AppearanceSettingsModal({
  open,
  appearance,
  saving,
  error,
  onClose,
  onSave,
  onUpload
}: AppearanceSettingsModalProps) {
  const [form, setForm] = useState<AppearanceSettings>(defaultAppearance);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        background: {
          ...defaultAppearance.background,
          ...appearance.background
        }
      });
    }
  }, [appearance, open]);

  if (!open) {
    return null;
  }

  const background = { ...defaultBackground, ...form.background };

  function setPreset(preset: AppearancePresetId) {
    setForm((current) => ({
      background: {
        ...defaultAppearance.background,
        ...current.background,
        mode: "preset",
        preset
      }
    }));
  }

  function updateNumber(field: "dim" | "blur", value: string) {
    setForm((current) => ({
      background: {
        ...defaultAppearance.background,
        ...current.background,
        [field]: Number(value)
      }
    }));
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setUploading(true);

    try {
      const imageUrl = await onUpload(file);
      setForm((current) => ({
        background: {
          ...defaultAppearance.background,
          ...current.background,
          mode: "custom",
          imageUrl,
          dim: Math.max(current.background?.dim ?? 0, 62)
        }
      }));
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 backdrop-blur sm:items-center sm:justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-deck-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-100/80">Appearance</p>
            <h2 className="text-xl font-semibold text-white">Dashboard background</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close appearance settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
          {error ? <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setForm(defaultAppearance)}
              className={`flex min-h-24 items-end rounded-xl border p-3 text-left transition ${
                background.mode === "default"
                  ? "border-amber-200/50 bg-amber-200/10 text-amber-50"
                  : "border-white/10 bg-[#25313b]/70 text-slate-300 hover:border-cyan-200/25"
              }`}
            >
              <span>
                <span className="block text-sm font-semibold">Default</span>
                <span className="mt-1 block text-xs text-slate-500">Anya calm glow</span>
              </span>
            </button>

            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setPreset(preset.id)}
                className={`relative min-h-24 overflow-hidden rounded-xl border p-3 text-left transition ${
                  background.mode === "preset" && background.preset === preset.id
                    ? "border-amber-200/50 text-amber-50"
                    : "border-white/10 text-slate-200 hover:border-cyan-200/25"
                }`}
              >
                <span className={`absolute inset-0 ${preset.className}`} />
                <span className="absolute inset-0 bg-black/20" />
                <span className="relative flex h-full items-end text-sm font-semibold">{preset.name}</span>
              </button>
            ))}
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
                <Upload className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-100">{uploading ? "Uploading..." : "Upload own image"}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">JPG, PNG or WebP, max 10 MB.</span>
              </span>
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading || saving}
              onChange={(event) => void handleUpload(event)}
              className="hidden"
            />
            <Image className="h-5 w-5 shrink-0 text-slate-500" />
          </label>

          {background.imageUrl ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <div
                className="h-36 bg-cover bg-center"
                style={{ backgroundImage: `url(${background.imageUrl})` }}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                <span className="truncate text-xs text-slate-500">{background.imageUrl}</span>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ background: { ...defaultAppearance.background, ...current.background, mode: "custom" } }))}
                    className={`h-9 rounded-lg px-3 text-xs font-semibold transition ${
                      background.mode === "custom" ? "bg-amber-300 text-slate-950" : "border border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Use image
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(defaultAppearance)}
                    className="h-9 rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/15"
                  >
                    Remove image
                  </button>
                </span>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span className="mb-3 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Dim</span>
              <input
                type="range"
                min="0"
                max="90"
                value={background.dim ?? 45}
                onChange={(event) => updateNumber("dim", event.target.value)}
                className="w-full accent-amber-300"
              />
              <span className="mt-2 block text-sm font-semibold text-slate-200">{background.dim ?? 45}%</span>
            </label>

            <label className="block rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span className="mb-3 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Blur</span>
              <input
                type="range"
                min="0"
                max="18"
                value={background.blur ?? 0}
                onChange={(event) => updateNumber("blur", event.target.value)}
                className="w-full accent-amber-300"
              />
              <span className="mt-2 block text-sm font-semibold text-slate-200">{background.blur ?? 0}px</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end border-t border-white/10 p-5">
          <button
            type="submit"
            disabled={saving || uploading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save appearance"}
          </button>
        </div>
      </form>
    </div>
  );
}
