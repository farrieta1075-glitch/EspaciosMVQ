import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import { getResourceById, updateResource } from "@/lib/sheets/resources";

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

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "resources");
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${resourceId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  const imageUrl = `/uploads/resources/${filename}`;
  const updated = await updateResource(resourceId, { imageUrl });

  return NextResponse.json(updated);
}
