import "server-only";
import { get, list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getBlobAccessMode } from "@/lib/storage/blob-access";

const FILENAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export async function serveBlobFile(
  folder: "maps" | "resources",
  filename: string,
): Promise<Response> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      {
        error: "Almacenamiento no configurado",
        code: "NO_BLOB_TOKEN",
      },
      { status: 503 },
    );
  }

  const decoded = decodeURIComponent(filename);
  if (!decoded || !FILENAME_PATTERN.test(decoded)) {
    return NextResponse.json(
      { error: "Nombre de archivo inválido", code: "INVALID_NAME" },
      { status: 400 },
    );
  }

  const pathname = `${folder}/${decoded}`;
  const access = getBlobAccessMode();

  let result = await get(pathname, { access, token });

  if (!result || result.statusCode !== 200 || !result.stream) {
    const dot = decoded.lastIndexOf(".");
    const base = dot > 0 ? decoded.slice(0, dot) : decoded;
    const listed = await list({
      prefix: `${folder}/${base}.`,
      token,
      limit: 20,
    });
    const fallback = listed.blobs[0];
    if (fallback) {
      result = await get(fallback.pathname, { access, token });
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
    },
  });
}
