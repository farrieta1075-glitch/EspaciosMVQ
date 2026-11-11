import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { get, list } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  getBlobAccessMode,
  getBlobRequestOptions,
  isBlobConfigured,
} from "@/lib/storage/blob-access";

const FILENAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

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

async function serveLocalUpload(
  folder: "maps" | "resources",
  filename: string,
): Promise<Response | null> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    folder,
    filename,
  );
  try {
    const buffer = await readFile(filePath);
    return new Response(buffer, {
      headers: {
        "Content-Type": contentTypeForFilename(filename),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
        "X-Storage-Source": "vps-uploads",
      },
    });
  } catch {
    return null;
  }
}

export async function serveBlobFile(
  folder: "maps" | "resources",
  filename: string,
): Promise<Response> {
  const decoded = decodeURIComponent(filename);
  if (!decoded || !FILENAME_PATTERN.test(decoded)) {
    return NextResponse.json(
      { error: "Nombre de archivo inválido", code: "INVALID_NAME" },
      { status: 400 },
    );
  }

  const local = await serveLocalUpload(folder, decoded);
  if (local) {
    return local;
  }

  if (!isBlobConfigured()) {
    return NextResponse.json(
      {
        error: "Archivo no encontrado en el servidor",
        code: "NO_LOCAL_OR_BLOB",
        hint: "Ejecuta scripts/migrate-blob-to-vps-uploads.mjs o define BLOB_READ_WRITE_TOKEN.",
      },
      { status: 404 },
    );
  }

  const blobAuth = getBlobRequestOptions();
  const pathname = `${folder}/${decoded}`;
  const access = getBlobAccessMode();

  let result = await get(pathname, { access, ...blobAuth });

  if (!result || result.statusCode !== 200 || !result.stream) {
    const dot = decoded.lastIndexOf(".");
    const base = dot > 0 ? decoded.slice(0, dot) : decoded;
    const listed = await list({
      prefix: `${folder}/${base}.`,
      ...blobAuth,
      limit: 20,
    });
    const fallback = listed.blobs[0];
    if (fallback) {
      result = await get(fallback.pathname, { access, ...blobAuth });
    }
  }

  if (!result || result.statusCode !== 200 || !result.stream) {
    return NextResponse.json(
      {
        error: "Archivo no encontrado en Blob",
        code: "BLOB_NOT_FOUND",
        pathname,
        hint: "Ejecuta npm run migrate:uploads-to-blob o sube de nuevo el archivo en Admin.",
      },
      { status: 404 },
    );
  }

  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
