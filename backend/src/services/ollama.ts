import type { DashboardConfig } from "../types.js";

interface OllamaTagsResponse {
  models?: Array<{ name?: string; modified_at?: string; size?: number }>;
}

interface OllamaChatResponse {
  model?: string;
  message?: {
    content?: string;
  };
  total_duration?: number;
  eval_count?: number;
}

interface OllamaChatStreamLine extends OllamaChatResponse {
  done?: boolean;
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function baseUrl(config: DashboardConfig) {
  return config.integrations?.ollama?.baseUrl?.replace(/\/+$/, "");
}

function defaultModel(config: DashboardConfig) {
  return config.integrations?.ollama?.model;
}

function cleanModelResponse(response: string) {
  return response
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*<\/think>/i, "")
    .trim();
}

async function requestOllama<T>(config: DashboardConfig, path: string, init?: RequestInit): Promise<T> {
  const url = baseUrl(config);

  if (!url) {
    throw new Error("Ollama is not configured");
  }

  let response: Response;

  try {
    response = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init?.headers
      },
      signal: AbortSignal.timeout(300_000)
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Ollama request timed out after 300 seconds");
    }

    throw error;
  }

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  return (await response.json()) as T;
}

async function requestOllamaResponse(config: DashboardConfig, path: string, init?: RequestInit) {
  const url = baseUrl(config);

  if (!url) {
    throw new Error("Ollama is not configured");
  }

  let response: Response;

  try {
    response = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson, application/json",
        ...init?.headers
      },
      signal: AbortSignal.timeout(300_000)
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Ollama request timed out after 300 seconds");
    }

    throw error;
  }

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  return response;
}

export async function getOllamaInfo(config: DashboardConfig) {
  const configured = Boolean(baseUrl(config));

  if (!configured) {
    return {
      status: "unknown" as const,
      configured,
      baseUrl: "",
      model: "",
      models: [],
      error: "Ollama is not configured"
    };
  }

  try {
    const tags = await requestOllama<OllamaTagsResponse>(config, "/api/tags");
    const models = (tags.models ?? []).map((model) => model.name).filter((name): name is string => Boolean(name));
    const model = defaultModel(config) || models[0] || "";

    return {
      status: "online" as const,
      configured,
      baseUrl: baseUrl(config) ?? "",
      model,
      models
    };
  } catch (error) {
    return {
      status: "offline" as const,
      configured,
      baseUrl: baseUrl(config) ?? "",
      model: defaultModel(config) ?? "",
      models: [],
      error: error instanceof Error ? error.message : "Ollama unavailable"
    };
  }
}

export async function askOllama(config: DashboardConfig, prompt: string, model?: string) {
  return chatWithOllama(config, [{ role: "user", content: prompt }], model);
}

export async function chatWithOllama(config: DashboardConfig, messages: OllamaMessage[], model?: string) {
  const cleanMessages = messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim()
    }))
    .filter((message) => message.content)
    .slice(-16);
  const lastUserMessage = [...cleanMessages].reverse().find((message) => message.role === "user");

  if (!lastUserMessage) {
    throw new Error("Prompt is required");
  }

  const selectedModel = model?.trim() || defaultModel(config);

  if (!selectedModel) {
    throw new Error("Ollama model is required");
  }

  const result = await requestOllama<OllamaChatResponse>(config, "/api/chat", {
    method: "POST",
    body: JSON.stringify({
      model: selectedModel,
      messages: cleanMessages,
      think: false,
      stream: false
    })
  });

  return {
    model: result.model ?? selectedModel,
    response: cleanModelResponse(result.message?.content ?? ""),
    durationMs: result.total_duration ? Math.round(result.total_duration / 1_000_000) : undefined,
    tokens: result.eval_count
  };
}

export async function* chatWithOllamaStream(config: DashboardConfig, messages: OllamaMessage[], model?: string) {
  const cleanMessages = messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim()
    }))
    .filter((message) => message.content)
    .slice(-16);
  const lastUserMessage = [...cleanMessages].reverse().find((message) => message.role === "user");

  if (!lastUserMessage) {
    throw new Error("Prompt is required");
  }

  const selectedModel = model?.trim() || defaultModel(config);

  if (!selectedModel) {
    throw new Error("Ollama model is required");
  }

  const response = await requestOllamaResponse(config, "/api/chat", {
    method: "POST",
    body: JSON.stringify({
      model: selectedModel,
      messages: cleanMessages,
      think: false,
      stream: true
    })
  });

  if (!response.body) {
    throw new Error("Ollama did not return a stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      const payload = JSON.parse(trimmed) as OllamaChatStreamLine;
      const content = payload.message?.content ?? "";

      if (content) {
        yield content;
      }
    }
  }

  const tail = buffer.trim();
  if (tail) {
    const payload = JSON.parse(tail) as OllamaChatStreamLine;
    const content = payload.message?.content ?? "";

    if (content) {
      yield content;
    }
  }
}
