import { auth } from "@/lib/auth/index";
import { can, isAdmin } from "@/lib/auth/permissions";
import { getCachedCatalogBundle } from "@/lib/sheets/cached-catalog";
import { listAllReservationDetails } from "@/lib/reservation-service";
import { CalendarClient } from "@/components/calendar/calendar-client";

interface CalendarioPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function CalendarioPage({
  searchParams,
}: CalendarioPageProps) {
  const session = await auth();
  const canReserve = can(session?.user ?? null, "create:reservation");
  const params = await searchParams;

  const [[maps, spaces, areas], reservations] = await Promise.all([
    getCachedCatalogBundle(),
    listAllReservationDetails(),
  ]);

  const admin = isAdmin(session?.user ?? null);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
      </header>

      <CalendarClient
        reservations={reservations}
        maps={maps}
        spaces={spaces}
        areas={areas}
        isAdmin={admin}
        canReserve={canReserve}
        viewerAreaId={session?.user?.areaId ?? null}
        initialDate={params.date}
      />
    </section>
  );
}
