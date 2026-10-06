import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import { createSpace, getAllSpaces } from "@/lib/sheets/spaces";

const createSpaceSchema = z.object({
  name: z.string().min(1),
  floor: z.string().optional().default(""),
  capacity: z.coerce.number().optional().default(0),
  minCapacity: z.coerce.number().optional().default(1),
  mapId: z.string().optional().default(""),
  active: z.boolean().optional().default(true),
  geometry: z
    .object({
      type: z.enum(["rect", "polygon"]),
      points: z.array(z.number()),
      color: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const spaces = await getAllSpaces();
  return NextResponse.json(spaces);
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createSpaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const space = await createSpace({
    name: parsed.data.name,
    floor: parsed.data.floor,
    capacity: parsed.data.capacity,
    minCapacity: parsed.data.minCapacity,
    mapId: parsed.data.mapId,
    active: parsed.data.active,
    geometry: parsed.data.geometry ?? null,
  });

  return NextResponse.json(space, { status: 201 });
}
