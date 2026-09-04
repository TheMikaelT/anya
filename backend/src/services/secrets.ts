import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SecretSettings } from "../types.js";

const defaultSecretsPath = path.resolve(process.cwd(), "../config/secrets.json");

function getSecretsPath() {
  return process.env.SECRETS_PATH ? path.resolve(process.env.SECRETS_PATH) : defaultSecretsPath;
}

export async function loadSecretSettings(): Promise<SecretSettings> {
  try {
    const raw = await readFile(getSecretsPath(), "utf-8");
    return JSON.parse(raw) as SecretSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

export async function saveSecretSettings(secrets: SecretSettings): Promise<SecretSettings> {
  const secretsPath = getSecretsPath();
  await mkdir(path.dirname(secretsPath), { recursive: true });
  const tempPath = `${secretsPath}.${randomUUID()}.tmp`;

  await writeFile(tempPath, `${JSON.stringify(secrets, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
  await rename(tempPath, secretsPath);

  return secrets;
}

export function redactSecret(value?: string) {
  return value ? "configured" : "";
}
