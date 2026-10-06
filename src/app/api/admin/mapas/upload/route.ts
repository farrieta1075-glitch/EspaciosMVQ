import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import { getMapById, updateMap } from "@/lib/sheets/maps";

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

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "maps");
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${mapId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  const backgroundUrl = `/uploads/maps/${filename}`;
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
