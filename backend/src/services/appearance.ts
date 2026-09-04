import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfigDirectory } from "./config.js";

const allowedImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export function getUploadsDirectory() {
  return path.join(getConfigDirectory(), "uploads");
}

export function getBackgroundUploadsDirectory() {
  return path.join(getUploadsDirectory(), "backgrounds");
}

export async function saveBackgroundImage(contentType: string | undefined, body: unknown) {
  const normalizedType = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = allowedImageTypes[normalizedType];

  if (!extension) {
    throw new Error("Background image must be a JPG, PNG or WebP file");
  }

  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new Error("Background image file is required");
  }

  const directory = getBackgroundUploadsDirectory();
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), body);

  return {
    imageUrl: `/api/uploads/backgrounds/${filename}`
  };
}
