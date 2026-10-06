import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/index";
import { isAdmin } from "@/lib/auth/permissions";
import { canModifyReservation } from "@/lib/auth/reservation-permissions";
import { getAllAreas } from "@/lib/sheets/areas";
import { getAllMaps } from "@/lib/sheets/maps";
import { getAllSpaces } from "@/lib/sheets/spaces";
import { formatReservationDateTimeRange } from "@/lib/date-utils";
import { getReservationDetail } from "@/lib/reservation-service";
import { getReservationById } from "@/lib/sheets/reservations";
import { ReservationEditFlow } from "@/components/reservation/reservation-edit-flow";

export default async function EditarReservaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const reservation = await getReservationById(id);
  if (
    !reservation ||
    reservation.status === "CANCELLED" ||
    !canModifyReservation(session.user, reservation)
  ) {
    notFound();
  }

  const [detail, maps, spaces, areas] = await Promise.all([
    getReservationDetail(id),
    getAllMaps(),
    getAllSpaces(),
    getAllAreas(),
  ]);

  if (!detail) notFound();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Editar reserva
        </h1>
        <p className="text-sm text-muted-foreground">
          {detail.eventName} ·{" "}
          {formatReservationDateTimeRange(detail.startAt, detail.endAt)}
        </p>
      </header>

      <ReservationEditFlow
        reservation={detail}
        maps={maps}
        spaces={spaces}
        areas={areas}
        isAdmin={isAdmin(session.user)}
      />
    </section>
  );
}
