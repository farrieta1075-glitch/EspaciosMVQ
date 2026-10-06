import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import { createResource, getAllResources } from "@/lib/sheets/resources";

const createResourceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["TECNICO", "CONSUMIBLE", "OTRO"]),
  totalQty: z.coerce.number().min(0).optional().default(0),
  imageUrl: z.string().optional().default(""),
  scope: z.enum(["GLOBAL", "RESTRICTED"]).optional().default("GLOBAL"),
  active: z.boolean().optional().default(true),
  restrictedSpaceIds: z.array(z.string()).optional().default([]),
});

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const resources = await getAllResources();
  return NextResponse.json(resources);
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createResourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (
    parsed.data.scope === "RESTRICTED" &&
    parsed.data.restrictedSpaceIds.length === 0
  ) {
    return NextResponse.json(
      { error: "Selecciona al menos un espacio para recursos restringidos." },
      { status: 400 },
    );
  }

  const resource = await createResource(parsed.data);
  return NextResponse.json(resource, { status: 201 });
}
