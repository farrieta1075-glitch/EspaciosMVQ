import { NextResponse } from "next/server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import { getResourceById, updateResource } from "@/lib/sheets/resources";
import { storePublicFile } from "@/lib/storage/public-files";

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const formData = await request.formData();
  const file = formData.get("file");
  const resourceId = formData.get("resourceId");

  if (!(file instanceof File) || typeof resourceId !== "string") {
    return NextResponse.json(
      { error: "Archivo o resourceId inválido" },
      { status: 400 },
    );
  }

  const resource = await getResourceById(resourceId);
  if (!resource) {
    return NextResponse.json({ error: "Recurso no encontrado" }, { status: 404 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  if (!["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    return NextResponse.json(
      { error: "Formato de imagen no soportado" },
      { status: 400 },
    );
  }

  const filename = `${resourceId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let imageUrl: string;
  try {
    imageUrl = await storePublicFile({
      folder: "resources",
      filename,
      buffer,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar el archivo";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const updated = await updateResource(resourceId, { imageUrl });

  return NextResponse.json(updated);
}
