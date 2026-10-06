import { NextResponse } from "next/server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import { getMapById, updateMap } from "@/lib/sheets/maps";
import { storePublicFile } from "@/lib/storage/public-files";

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const formData = await request.formData();
  const file = formData.get("file");
  const mapId = formData.get("mapId");
  const backgroundType = formData.get("backgroundType");

  if (!(file instanceof File) || typeof mapId !== "string") {
    return NextResponse.json({ error: "Archivo o mapId inválido" }, { status: 400 });
  }

  const map = await getMapById(mapId);
  if (!map) {
    return NextResponse.json({ error: "Mapa no encontrado" }, { status: 404 });
  }

  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.name.split(".").pop()?.toLowerCase() ?? "png";

  const filename = `${mapId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let backgroundUrl: string;
  try {
    backgroundUrl = await storePublicFile({
      folder: "maps",
      filename,
      buffer,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar el archivo";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const type =
    backgroundType === "pdf" || ext === "pdf"
      ? "pdf"
      : backgroundType === "image" || ["png", "jpg", "jpeg", "webp"].includes(ext)
        ? "image"
        : "blank";

  const updated = await updateMap(mapId, {
    backgroundUrl,
    backgroundType: type,
  });

  return NextResponse.json(updated);
}
