import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import {
  deleteSpace,
  getSpaceById,
  updateSpace,
} from "@/lib/sheets/spaces";

const updateSpaceSchema = z.object({
  name: z.string().min(1).optional(),
  floor: z.string().optional(),
  capacity: z.coerce.number().optional(),
  mapId: z.string().optional(),
  active: z.boolean().optional(),
  geometry: z
    .object({
      type: z.enum(["rect", "polygon"]),
      points: z.array(z.number()),
      color: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const space = await getSpaceById(id);
  if (!space) {
    return NextResponse.json({ error: "Espacio no encontrado" }, { status: 404 });
  }

  return NextResponse.json(space);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSpaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await updateSpace(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Espacio no encontrado" }, { status: 404 });
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
  const ok = await deleteSpace(id);
  if (!ok) {
    return NextResponse.json({ error: "Espacio no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
