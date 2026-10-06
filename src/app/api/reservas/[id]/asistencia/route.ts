import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/index";
import { canConfirmAttendance } from "@/lib/auth/reservation-permissions";
import { confirmReservationAttendance } from "@/lib/reservation-service";
import { getReservationById } from "@/lib/sheets/reservations";

const bodySchema = z.object({
  actualAttendees: z.coerce.number().min(1),
  attendanceComment: z.string().optional().default(""),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const reservation = await getReservationById(id);
  if (!reservation || !canConfirmAttendance(session.user, reservation)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const detail = await confirmReservationAttendance(id, parsed.data);
    revalidatePath("/reservas");
    return NextResponse.json(detail);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al guardar asistencia";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
