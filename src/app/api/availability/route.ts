import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/index";
import { getAvailability } from "@/lib/availability";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  mapId: z.string().min(1),
  selectedSpaceIds: z.string().optional(),
  excludeReservationId: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    date: searchParams.get("date"),
    startTime: searchParams.get("startTime"),
    endTime: searchParams.get("endTime"),
    mapId: searchParams.get("mapId"),
    selectedSpaceIds: searchParams.get("selectedSpaceIds") ?? undefined,
    excludeReservationId: searchParams.get("excludeReservationId") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const selectedSpaceIds = parsed.data.selectedSpaceIds
    ? parsed.data.selectedSpaceIds.split(",").filter(Boolean)
    : [];

  const availability = await getAvailability({
    date: parsed.data.date,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    mapId: parsed.data.mapId,
    selectedSpaceIds,
    excludeReservationId: parsed.data.excludeReservationId,
  });

  return NextResponse.json(availability);
}
