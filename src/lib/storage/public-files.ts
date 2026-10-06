import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import {
  getBlobAccessMode,
  getBlobRequestOptions,
  isBlobConfigured,
} from "@/lib/storage/blob-access";

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

function contentTypeForFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export async function storePublicFile(options: {
  folder: "maps" | "resources";
  filename: string;
  buffer: Buffer;
}): Promise<string> {
  const contentType = contentTypeForFilename(options.filename);

  if (isBlobConfigured()) {
    const access = getBlobAccessMode();
    const pathname = `${options.folder}/${options.filename}`;
    const blob = await put(pathname, options.buffer, {
      access,
      contentType,
      ...getBlobRequestOptions(),
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    if (access === "private") {
      return `blob:${blob.pathname}`;
    }

    return blob.url;
  }

  if (process.env.VERCEL === "1") {
    throw new Error(
      "En Vercel conecta Storage → Blob al proyecto o configura BLOB_READ_WRITE_TOKEN.",
    );
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", options.folder);
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, options.filename), options.buffer);
  return `/uploads/${options.folder}/${options.filename}`;
}
