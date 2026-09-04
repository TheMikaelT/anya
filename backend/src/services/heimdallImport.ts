import { readFile } from "node:fs/promises";
import initSqlJs from "sql.js";
import type { DashboardLinkInput, ImportPreview, ServiceTemplate } from "../types.js";

interface HeimdallRow {
  title: string;
  url: string;
  appdescription: string | null;
  description: string | null;
  deleted_at: string | null;
  class: string | null;
}

function rowToObject(columns: string[], row: unknown[]): HeimdallRow {
  return Object.fromEntries(columns.map((column, index) => [column, row[index]])) as unknown as HeimdallRow;
}

function findTemplate(name: string, className: string | null, templates: ServiceTemplate[]) {
  const haystack = `${name} ${className ?? ""}`.toLowerCase();
  return templates.find((template) => haystack.includes(template.id) || haystack.includes(template.name.toLowerCase()));
}

export async function previewHeimdallImport(templates: ServiceTemplate[]): Promise<ImportPreview> {
  const dbPath = process.env.HEIMDALL_DB_PATH;

  if (!dbPath) {
    return {
      source: "heimdall",
      configured: false,
      items: [],
      skipped: 0,
      error: "HEIMDALL_DB_PATH is not configured"
    };
  }

  try {
    const SQL = await initSqlJs();
    const db = new SQL.Database(await readFile(dbPath));
    const result = db.exec(
      "select title, url, appdescription, description, deleted_at, class from items where deleted_at is null and url is not null and url != '' order by \"order\", id"
    )[0];

    if (!result) {
      return { source: "heimdall", configured: true, items: [], skipped: 0 };
    }

    const items = result.values
      .map((row) => rowToObject(result.columns, row))
      .filter((row) => row.title !== "app.dashboard")
      .map<DashboardLinkInput>((row) => {
        const template = findTemplate(row.title, row.class, templates);
        return {
          name: row.title,
          url: row.url,
          description: row.appdescription ?? row.description ?? template?.description ?? "Imported from Heimdall",
          category: template?.category ?? "Imported",
          icon: template?.icon ?? "server",
          iconUrl: template?.iconUrl
        };
      });

    db.close();
    return { source: "heimdall", configured: true, items, skipped: 0 };
  } catch (error) {
    return {
      source: "heimdall",
      configured: true,
      items: [],
      skipped: 0,
      error: error instanceof Error ? error.message : "Heimdall import failed"
    };
  }
}
