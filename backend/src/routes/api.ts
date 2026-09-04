import express, { Router } from "express";
import {
  createDashboardLink,
  deleteDashboardLink,
  deleteIntegrationSettings,
  importDashboardLinks,
  linksResponse,
  loadDashboardConfig,
  loadServiceTemplates,
  updateDashboardLink,
  updateIntegrationSettings,
  updateLinkLayout,
  updateLinkOrder,
  updateRssFeeds,
  updateAppearanceSettings,
  updateSearchSettings,
  updateWidgetOrder,
  updateWidgetSettings
} from "../services/config.js";
import { saveBackgroundImage } from "../services/appearance.js";
import { askAnyaAssistant, streamAnyaAssistant } from "../services/assistant.js";
import { listAssistantTurns } from "../services/assistantHistory.js";
import { getBackupStatus, runBackup, verifyBackup } from "../services/backup.js";
import { discoverDockerServices } from "../services/dockerDiscovery.js";
import { getDockerWidgetData } from "../services/docker.js";
import { previewHeimdallImport } from "../services/heimdallImport.js";
import { loadIconCatalog, refreshIconCatalog } from "../services/iconCatalog.js";
import { getIntegrationInfo } from "../services/integrations.js";
import { getGluetunWidgetData } from "../services/gluetun.js";
import { getHealthOverview, getNotifications } from "../services/healthOverview.js";
import { createJournalEntry, deleteJournalEntry, listJournalEntries, updateJournalEntry } from "../services/journal.js";
import { getMailWidgetData } from "../services/mail.js";
import { createNote, deleteNote, listNotes, updateNote } from "../services/notes.js";
import { acknowledgeNotification, acknowledgeOpenNotifications, listNotificationHistory } from "../services/notificationEvents.js";
import { chatWithOllama, getOllamaInfo, type OllamaMessage } from "../services/ollama.js";
import { getPlexWidgetData, requestPlexImage } from "../services/plex.js";
import { getQBittorrentWidgetData } from "../services/qbittorrent.js";
import { clearRssCache, fetchRssFeeds } from "../services/rss.js";
import { refreshServiceLibrary } from "../services/serviceLibrary.js";
import { checkServiceStatuses } from "../services/status.js";
import { createReminder, createTask, deleteReminder, deleteTask, listReminders, listTasks, updateReminder, updateTask } from "../services/tasks.js";
import { getTodayOverview } from "../services/today.js";
import { synthesizeSpeech } from "../services/tts.js";
import { getUnifiWidgetData } from "../services/unifi.js";
import { getHomeAssistantControlOptions, getServiceIntegrationData, getServicesStatusData, runServiceIntegrationAction, serviceDefinitions } from "../services/additionalIntegrations.js";

export const apiRouter = Router();

apiRouter.get("/links", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json(linksResponse(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/links", async (req, res, next) => {
  try {
    const config = await createDashboardLink(req.body);
    res.status(201).json(linksResponse(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/links/order", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown): id is string => typeof id === "string") : [];
    const config = await updateLinkOrder(ids);
    res.json(linksResponse(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/links/layout", async (req, res, next) => {
  try {
    const config = await updateLinkLayout(req.body?.layout === "grid" ? "grid" : "grouped");
    res.json(linksResponse(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/links/:id", async (req, res, next) => {
  try {
    const config = await updateDashboardLink(req.params.id, req.body);
    res.json(linksResponse(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/links/:id", async (req, res, next) => {
  try {
    const config = await deleteDashboardLink(req.params.id);
    res.json(linksResponse(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/templates", async (_req, res, next) => {
  try {
    res.json({ templates: await loadServiceTemplates() });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/icons", async (_req, res, next) => {
  try {
    res.json(await loadIconCatalog());
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/icons/refresh", async (_req, res, next) => {
  try {
    res.json(await refreshIconCatalog());
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/services/refresh-library", async (_req, res, next) => {
  try {
    res.json(await refreshServiceLibrary());
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/integrations", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json({ integrations: await getIntegrationInfo(config) });
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/integrations", async (req, res, next) => {
  try {
    const config = await updateIntegrationSettings(req.body);
    res.json({ integrations: await getIntegrationInfo(config) });
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/integrations/:id", async (req, res, next) => {
  try {
    const id = req.params.id;

    if (!["docker", "plex", "unifi", "ollama", "qbittorrent", "gluetun", "mail", ...serviceDefinitions.map((definition) => definition.id)].includes(id)) {
      throw new Error("Integration not found");
    }

    const config = await deleteIntegrationSettings(id as Parameters<typeof deleteIntegrationSettings>[0]);
    res.json({ integrations: await getIntegrationInfo(config) });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/integrations/:id/test", async (req, res, next) => {
  try {
    const id = req.params.id;

    if (!["docker", "plex", "unifi", "ollama", "qbittorrent", "gluetun", "mail", ...serviceDefinitions.map((definition) => definition.id)].includes(id)) {
      throw new Error("Integration not found");
    }

    const startedAt = Date.now();
    const config = await loadDashboardConfig();
    let payload: unknown;

    if (id === "docker") {
      payload = await getDockerWidgetData(config);
    } else if (id === "plex") {
      payload = await getPlexWidgetData(config);
    } else if (id === "unifi") {
      payload = await getUnifiWidgetData(config);
    } else if (id === "ollama") {
      payload = await getOllamaInfo(config);
    } else if (id === "qbittorrent") {
      payload = await getQBittorrentWidgetData(config);
    } else if (id === "gluetun") {
      payload = await getGluetunWidgetData(config);
    } else if (id === "mail") {
      payload = await getMailWidgetData(config);
    } else {
      payload = await getServiceIntegrationData(config, id as typeof serviceDefinitions[number]["id"]);
    }

    const data = payload as { status?: string; error?: string; configured?: boolean };

    res.json({
      id,
      ok: data.status === "online",
      status: data.status ?? "unknown",
      configured: data.configured ?? true,
      durationMs: Date.now() - startedAt,
      error: data.error
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/services-status", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json(await getServicesStatusData(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/health/overview", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json(await getHealthOverview(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/notifications", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json(await getNotifications(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/notifications/history", async (_req, res, next) => {
  try {
    res.json(await listNotificationHistory());
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/notifications/:id/ack", async (req, res, next) => {
  try {
    res.json(await acknowledgeNotification(req.params.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/notifications/ack-all", async (_req, res, next) => {
  try {
    res.json(await acknowledgeOpenNotifications());
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/backup", async (_req, res, next) => {
  try {
    res.json(await getBackupStatus());
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/backup/run", async (_req, res, next) => {
  try {
    res.status(201).json(await runBackup());
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/backup/verify", async (req, res, next) => {
  try {
    const id = typeof req.body?.id === "string" ? req.body.id : undefined;
    const verification = await verifyBackup(id);
    const status = await getBackupStatus();

    res.json({ ...status, lastVerification: verification });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/notes", async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    res.json(await listNotes(query));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/notes", async (req, res, next) => {
  try {
    res.status(201).json(await createNote(req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/notes/:id", async (req, res, next) => {
  try {
    res.json(await updateNote(req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/notes/:id", async (req, res, next) => {
  try {
    res.json(await deleteNote(req.params.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/journal", async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    res.json(await listJournalEntries(query));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/journal", async (req, res, next) => {
  try {
    res.status(201).json(await createJournalEntry(req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/journal/:id", async (req, res, next) => {
  try {
    res.json(await updateJournalEntry(req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/journal/:id", async (req, res, next) => {
  try {
    res.json(await deleteJournalEntry(req.params.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/today", async (_req, res, next) => {
  try {
    res.json(await getTodayOverview());
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/tasks", async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    res.json(await listTasks(query));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/tasks", async (req, res, next) => {
  try {
    res.status(201).json(await createTask(req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/tasks/:id", async (req, res, next) => {
  try {
    res.json(await updateTask(req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/tasks/:id", async (req, res, next) => {
  try {
    res.json(await deleteTask(req.params.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/reminders", async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    res.json(await listReminders(query));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/reminders", async (req, res, next) => {
  try {
    res.status(201).json(await createReminder(req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/reminders/:id", async (req, res, next) => {
  try {
    res.json(await updateReminder(req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/reminders/:id", async (req, res, next) => {
  try {
    res.json(await deleteReminder(req.params.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/services/homeassistant/options", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json(await getHomeAssistantControlOptions(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/services/:id/action", async (req, res, next) => {
  try {
    const id = req.params.id;

    if (!serviceDefinitions.some((definition) => definition.id === id)) {
      throw new Error("Integration not found");
    }

    const entityId = typeof req.body?.entityId === "string" ? req.body.entityId : "";

    if (!entityId) {
      throw new Error("Missing entityId");
    }

    const config = await loadDashboardConfig();
    res.json(await runServiceIntegrationAction(config, id as typeof serviceDefinitions[number]["id"], entityId));
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/widgets", async (req, res, next) => {
  try {
    const config = await updateWidgetSettings(
      Array.isArray(req.body?.order) ? req.body.order : [],
      Array.isArray(req.body?.mobileOrder) ? req.body.mobileOrder : undefined,
      typeof req.body?.widgets === "object" && req.body.widgets ? req.body.widgets : {},
      req.body?.layout,
      req.body?.style
    );
    res.json(linksResponse(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/search", async (req, res, next) => {
  try {
    const config = await updateSearchSettings(req.body ?? {});
    res.json(linksResponse(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/appearance", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json({ appearance: config.appearance });
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/appearance", async (req, res, next) => {
  try {
    const config = await updateAppearanceSettings(req.body ?? {});
    res.json(linksResponse(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.post(
  "/appearance/background",
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "10mb" }),
  async (req, res, next) => {
    try {
      res.status(201).json(await saveBackgroundImage(req.headers["content-type"], req.body));
    } catch (error) {
      next(error);
    }
  }
);

apiRouter.put("/widgets/order", async (req, res, next) => {
  try {
    const config = await updateWidgetOrder(Array.isArray(req.body?.order) ? req.body.order : []);
    res.json(linksResponse(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/status", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json({ statuses: await checkServiceStatuses(config.links) });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/discover/docker", async (req, res, next) => {
  try {
    const templates = await loadServiceTemplates();
    const config = await loadDashboardConfig();
    const host = typeof req.query.host === "string" && req.query.host ? req.query.host : req.hostname;
    res.json({ suggestions: await discoverDockerServices(templates, host, config) });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/discover/docker/import", async (req, res, next) => {
  try {
    const templates = await loadServiceTemplates();
    const config = await loadDashboardConfig();
    const host = typeof req.body?.host === "string" && req.body.host ? req.body.host : req.hostname;
    const suggestions = await discoverDockerServices(templates, host, config);
    const result = await importDashboardLinks(suggestions);
    res.json({
      imported: result.imported,
      skipped: result.skipped,
      ...linksResponse(result.config)
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/import/heimdall/preview", async (_req, res, next) => {
  try {
    const templates = await loadServiceTemplates();
    res.json(await previewHeimdallImport(templates));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/import/heimdall", async (_req, res, next) => {
  try {
    const templates = await loadServiceTemplates();
    const preview = await previewHeimdallImport(templates);

    if (preview.error) {
      throw new Error(preview.error);
    }

    const result = await importDashboardLinks(preview.items);
    res.json({
      imported: result.imported,
      skipped: result.skipped,
      ...linksResponse(result.config)
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/rss", async (req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    if (req.query.refresh === "1") {
      clearRssCache();
    }
    const feeds = await fetchRssFeeds(config.rssFeeds);
    res.json({ feeds, rssSettings: config.rssSettings });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/rss/refresh", async (_req, res, next) => {
  try {
    clearRssCache();
    const config = await loadDashboardConfig();
    const feeds = await fetchRssFeeds(config.rssFeeds);
    res.json({ feeds, rssSettings: config.rssSettings });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/rss/feeds", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json({ rssFeeds: config.rssFeeds, rssSettings: config.rssSettings });
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/rss/feeds", async (req, res, next) => {
  try {
    clearRssCache();
    const config = await updateRssFeeds(Array.isArray(req.body?.rssFeeds) ? req.body.rssFeeds : [], req.body?.rssSettings);
    res.json(linksResponse(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/unifi", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json(await getUnifiWidgetData(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/plex", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json(await getPlexWidgetData(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/plex/image", async (req, res, next) => {
  try {
    const path = typeof req.query.path === "string" ? req.query.path : "";
    const config = await loadDashboardConfig();
    const image = await requestPlexImage(config, path);
    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", image.cacheControl);
    res.send(image.body);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/docker", async (_req, res) => {
  const config = await loadDashboardConfig();
  res.json(await getDockerWidgetData(config));
});

apiRouter.get("/qbittorrent", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json(await getQBittorrentWidgetData(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/gluetun", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json(await getGluetunWidgetData(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/mail", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json(await getMailWidgetData(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/ollama", async (_req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    res.json(await getOllamaInfo(config));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/ollama/ask", async (req, res, next) => {
  try {
    const config = await loadDashboardConfig();
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
    const model = typeof req.body?.model === "string" ? req.body.model : undefined;
    const messages = Array.isArray(req.body?.messages) ? cleanOllamaMessages(req.body.messages) : [];
    const nextMessages = messages.length ? messages : [{ role: "user" as const, content: prompt }];
    res.json(await chatWithOllama(config, nextMessages, model));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/assistant/ask", async (req, res, next) => {
  try {
    const question = typeof req.body?.question === "string" ? req.body.question : "";
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined;

    if (!question.trim()) {
      res.status(400).json({ error: "Question is required" });
      return;
    }

    const config = await loadDashboardConfig();
    res.json(await askAnyaAssistant(config, question, sessionId));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/assistant/history", async (req, res, next) => {
  try {
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 30;
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
    res.json(await listAssistantTurns(Number.isFinite(limit) ? limit : 30, sessionId));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/assistant/ask/stream", async (req, res, next) => {
  try {
    const question = typeof req.body?.question === "string" ? req.body.question : "";
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined;

    if (!question.trim()) {
      res.status(400).json({ error: "Question is required" });
      return;
    }

    const config = await loadDashboardConfig();
    const response = await streamAnyaAssistant(config, question, sessionId);

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    if (response.quickAnswer) {
      res.write(`${JSON.stringify({ type: "chunk", content: response.quickAnswer })}\n`);
      res.write(`${JSON.stringify({ type: "done", sources: response.sources, checkedAt: response.checkedAt })}\n`);
      res.end();
      return;
    }

    if (!response.stream) {
      throw new Error("Assistant stream could not be created");
    }

    for await (const content of response.stream) {
      res.write(`${JSON.stringify({ type: "chunk", content })}\n`);
    }

    res.write(`${JSON.stringify({ type: "done", sources: response.sources, checkedAt: response.checkedAt })}\n`);
    res.end();
  } catch (error) {
    if (res.headersSent) {
      res.write(`${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Assistant stream failed" })}\n`);
      res.end();
      return;
    }

    next(error);
  }
});

apiRouter.post("/assistant/tts", async (req, res, next) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const result = await synthesizeSpeech(text);

    if (result.audio) {
      res.setHeader("Content-Type", result.contentType ?? "audio/wav");
      res.setHeader("Cache-Control", "no-store");
      res.send(result.audio);
      return;
    }

    res.status(result.fallback ? 202 : 500).json({
      provider: result.provider,
      fallback: true,
      message: result.message ?? "TTS fallback required"
    });
  } catch (error) {
    next(error);
  }
});

function cleanOllamaMessages(input: unknown[]): OllamaMessage[] {
  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as { role?: unknown; content?: unknown };
      if (record.role !== "system" && record.role !== "user" && record.role !== "assistant") {
        return null;
      }

      if (typeof record.content !== "string") {
        return null;
      }

      return {
        role: record.role,
        content: record.content
      };
    })
    .filter((message): message is OllamaMessage => Boolean(message));
}
