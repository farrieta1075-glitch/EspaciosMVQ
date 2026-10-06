import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import { deleteMap, getMapById, updateMap } from "@/lib/sheets/maps";

const updateMapSchema = z.object({
  name: z.string().min(1).optional(),
  backgroundType: z.enum(["blank", "image", "pdf"]).optional(),
  backgroundUrl: z.string().optional(),
  width: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const map = await getMapById(id);
  if (!map) {
    return NextResponse.json({ error: "Mapa no encontrado" }, { status: 404 });
  }

  return NextResponse.json(map);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateMapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await updateMap(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Mapa no encontrado" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const ok = await deleteMap(id);
  if (!ok) {
    return NextResponse.json({ error: "Mapa no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
