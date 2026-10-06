import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/index";
import { getBlobAccessMode } from "@/lib/storage/blob-access";

const PATH_PATTERN = /^(maps|resources)\/.+$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "Almacenamiento no configurado" },
      { status: 503 },
    );
  }

  const segments = (await params).path ?? [];
  const pathname = segments.map(decodeURIComponent).join("/");

  if (!PATH_PATTERN.test(pathname)) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  const result = await get(pathname, {
    access: getBlobAccessMode(),
    token,
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
