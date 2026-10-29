import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import { deleteArea, getAreaById, updateArea } from "@/lib/sheets/areas";

const updateAreaSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  parentId: z.string().optional().nullable(),
  colorHex: z.string().optional(),
  eventPresets: z.array(z.string()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const area = await getAreaById(id);
  if (!area) {
    return NextResponse.json({ error: "Área no encontrada" }, { status: 404 });
  }
  return NextResponse.json(area);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const parsed = updateAreaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const area = await updateArea(id, parsed.data);
    if (!area) {
      return NextResponse.json({ error: "Área no encontrada" }, { status: 404 });
    }
    revalidateTag("catalog-areas");
    return NextResponse.json(area);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteArea(id);
    revalidateTag("catalog-areas");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar" },
      { status: 400 },
    );
  }
}
