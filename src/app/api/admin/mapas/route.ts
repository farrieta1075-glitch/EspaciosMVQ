import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import { createMap, getAllMaps } from "@/lib/sheets/maps";

const createMapSchema = z.object({
  name: z.string().min(1),
  backgroundType: z.enum(["blank", "image", "pdf"]).default("blank"),
  backgroundUrl: z.string().optional().default(""),
  width: z.coerce.number().optional().default(800),
  height: z.coerce.number().optional().default(600),
});

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const maps = await getAllMaps();
  return NextResponse.json(maps);
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createMapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const map = await createMap(parsed.data);
  return NextResponse.json(map, { status: 201 });
}
