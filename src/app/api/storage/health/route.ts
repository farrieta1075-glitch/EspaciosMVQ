import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { getBlobAccessMode } from "@/lib/storage/blob-access";

/** Comprueba que la API de storage está desplegada y el token de Blob funciona. */
export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({
      ok: false,
      code: "NO_BLOB_TOKEN",
      message: "Falta BLOB_READ_WRITE_TOKEN en Vercel",
    });
  }

  try {
    const maps = await list({ prefix: "maps/", token, limit: 5 });
    const resources = await list({ prefix: "resources/", token, limit: 5 });
    return NextResponse.json({
      ok: true,
      blobAccess: getBlobAccessMode(),
      sampleMapFiles: maps.blobs.map((b) => b.pathname),
      sampleResourceFiles: resources.blobs.map((b) => b.pathname),
      hint: "Prueba /api/storage/maps/NOMBRE-ARCHIVO.ext (ej. map-abc.png)",
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      code: "BLOB_LIST_FAILED",
      message: error instanceof Error ? error.message : "Error al listar Blob",
    });
  }
}
