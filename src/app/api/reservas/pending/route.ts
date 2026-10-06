import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/index";
import { isAdmin } from "@/lib/auth/permissions";
import { listPendingReservationDetails } from "@/lib/reservation-service";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const reservations = await listPendingReservationDetails();
  return NextResponse.json(
    reservations.sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    ),
  );
}
