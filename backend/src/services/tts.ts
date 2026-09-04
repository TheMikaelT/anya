export type TtsProvider = "browser" | "piper";

export interface TtsResponse {
  provider: TtsProvider;
  contentType?: string;
  audio?: Buffer;
  fallback?: boolean;
  message?: string;
}

function configuredProvider(): TtsProvider {
  return process.env.ANYA_TTS_PROVIDER === "piper" ? "piper" : "browser";
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 4000);
}

async function requestPiper(text: string): Promise<TtsResponse> {
  const baseUrl = process.env.ANYA_TTS_URL?.replace(/\/+$/, "");

  if (!baseUrl) {
    return {
      provider: "piper",
      fallback: true,
      message: "Piper URL is not configured"
    };
  }

  const response = await fetch(`${baseUrl}/api/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/wav, audio/mpeg, audio/ogg, application/octet-stream"
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(30_000)
  });

  if (!response.ok) {
    return {
      provider: "piper",
      fallback: true,
      message: `Piper returned ${response.status}`
    };
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    provider: "piper",
    contentType: response.headers.get("content-type") ?? "audio/wav",
    audio: Buffer.from(arrayBuffer)
  };
}

export async function synthesizeSpeech(input: string): Promise<TtsResponse> {
  const text = cleanText(input);

  if (!text) {
    return {
      provider: configuredProvider(),
      fallback: true,
      message: "Text is required"
    };
  }

  const provider = configuredProvider();

  if (provider === "browser") {
    return {
      provider,
      fallback: true,
      message: "Browser speech synthesis fallback"
    };
  }

  try {
    return await requestPiper(text);
  } catch (error) {
    return {
      provider,
      fallback: true,
      message: error instanceof Error ? error.message : "TTS request failed"
    };
  }
}
