import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import { createArea, getAllAreas } from "@/lib/sheets/areas";

const createAreaSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional().default(""),
  parentId: z.string().optional().nullable(),
  colorHex: z.string().optional().default(""),
  eventPresets: z.array(z.string()).optional().default([]),
});

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();
  return NextResponse.json(await getAllAreas());
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const parsed = createAreaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const area = await createArea(parsed.data);
    revalidateTag("catalog-areas");
    return NextResponse.json(area, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el área" },
      { status: 400 },
    );
  }
}
