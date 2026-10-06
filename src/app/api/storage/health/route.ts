import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import {
  getBlobAccessMode,
  getBlobAuthDiagnostics,
  getBlobRequestOptions,
  isBlobConfigured,
} from "@/lib/storage/blob-access";

/** Comprueba que la API de storage está desplegada y el Blob responde. */
export async function GET() {
  const diagnostics = getBlobAuthDiagnostics();

  if (!isBlobConfigured()) {
    return NextResponse.json({
      ok: false,
      code: "NO_BLOB_AUTH",
      message:
        "Conecta Blob al proyecto en Vercel (Storage) o define BLOB_READ_WRITE_TOKEN válido.",
      ...diagnostics,
    });
  }

  try {
    const blobAuth = getBlobRequestOptions();
    const maps = await list({ prefix: "maps/", ...blobAuth, limit: 5 });
    const resources = await list({ prefix: "resources/", ...blobAuth, limit: 5 });
    return NextResponse.json({
      ok: true,
      blobAccess: getBlobAccessMode(),
      ...diagnostics,
      sampleMapFiles: maps.blobs.map((b) => b.pathname),
      sampleResourceFiles: resources.blobs.map((b) => b.pathname),
      hint: "Prueba /api/storage/maps/NOMBRE-ARCHIVO.ext (ej. map-abc.png)",
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      code: "BLOB_LIST_FAILED",
      message: error instanceof Error ? error.message : "Error al listar Blob",
      ...diagnostics,
      fix:
        diagnostics.authMode === "read_write_token"
          ? "Regenera el token en Vercel → Storage → tu store → .env.local, o conecta el store al proyecto para usar authMode vercel_oidc."
          : "Verifica que el store Blob esté conectado a este proyecto y redeploy.",
    });
  }
}
