import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/index";
import { isAdmin } from "@/lib/auth/permissions";
import {
  canAccessReservation,
  canConfirmAttendance,
  canModifyReservation,
} from "@/lib/auth/reservation-permissions";
import { resolveUserAreaScopeIds } from "@/lib/area-scope";
import { isPastReservation } from "@/lib/reservation-utils";
import { AttendanceConfirmFlow } from "@/components/reservation/attendance-confirm-flow";
import { getUserById } from "@/lib/sheets/users";
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
    !canAccessReservation(session.user, reservation)
  ) {
    notFound();
  }

  const admin = isAdmin(session.user);
  const past = isPastReservation(reservation);
  const attendanceOnly = past && !admin && canConfirmAttendance(session.user, reservation);

  if (!attendanceOnly && !canModifyReservation(session.user, reservation)) {
    notFound();
  }

  const [detail, maps, spaces, areas] = await Promise.all([
    getReservationDetail(id),
    getAllMaps(),
    getAllSpaces(),
    getAllAreas(),
  ]);

  if (!detail) notFound();

  const userRecord = session.user.id
    ? await getUserById(session.user.id)
    : null;
  const userAreaScopeIds = userRecord
    ? resolveUserAreaScopeIds(userRecord)
    : [];
  const showAttendanceSection =
    past && admin && canConfirmAttendance(session.user, reservation);

  return (
    <section className="space-y-3">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {attendanceOnly ? "Registrar asistencia" : "Editar reserva"}
        </h1>
        {!attendanceOnly && (
          <p className="text-sm text-muted-foreground">
            {detail.eventName} ·{" "}
            {formatReservationDateTimeRange(detail.startAt, detail.endAt)}
          </p>
        )}
      </header>

      {attendanceOnly ? (
        <AttendanceConfirmFlow reservation={detail} />
      ) : (
        <>
          <ReservationEditFlow
            reservation={detail}
            maps={maps}
            spaces={spaces}
            areas={areas}
            isAdmin={admin}
            userAreaId={session.user.areaId ?? null}
            userAreaScopeIds={userAreaScopeIds}
            canViewAllSpaces={userRecord?.canViewAllSpaces === true}
          />
          {showAttendanceSection && (
            <div id="asistencia" className="scroll-mt-4 space-y-2 pt-2">
              <h2 className="text-lg font-semibold">Registrar asistencia</h2>
              <AttendanceConfirmFlow reservation={detail} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
