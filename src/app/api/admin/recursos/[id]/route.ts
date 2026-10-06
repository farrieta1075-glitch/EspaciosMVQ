import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import {
  deleteResource,
  getResourceById,
  updateResource,
} from "@/lib/sheets/resources";

const updateResourceSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["TECNICO", "CONSUMIBLE", "OTRO"]).optional(),
  totalQty: z.coerce.number().min(0).optional(),
  imageUrl: z.string().optional(),
  scope: z.enum(["GLOBAL", "RESTRICTED"]).optional(),
  active: z.boolean().optional(),
  restrictedSpaceIds: z.array(z.string()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const resource = await getResourceById(id);
  if (!resource) {
    return NextResponse.json({ error: "Recurso no encontrado" }, { status: 404 });
  }

  return NextResponse.json(resource);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateResourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (
    parsed.data.scope === "RESTRICTED" &&
    parsed.data.restrictedSpaceIds !== undefined &&
    parsed.data.restrictedSpaceIds.length === 0
  ) {
    return NextResponse.json(
      { error: "Selecciona al menos un espacio para recursos restringidos." },
      { status: 400 },
    );
  }

  const updated = await updateResource(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Recurso no encontrado" }, { status: 404 });
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
  const ok = await deleteResource(id);
  if (!ok) {
    return NextResponse.json({ error: "Recurso no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
