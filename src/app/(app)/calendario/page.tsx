import Link from "next/link";
import { auth } from "@/lib/auth/index";
import { can, isAdmin } from "@/lib/auth/permissions";
import { getCachedCatalogBundle } from "@/lib/sheets/cached-catalog";
import { listAllReservationDetails } from "@/lib/reservation-service";
import { CalendarClient } from "@/components/calendar/calendar-client";
import { Button } from "@/components/ui/button";

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
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
          <p className="text-sm text-muted-foreground">
            Vistas semanal y mensual con reservas de todas las áreas por color.
            Usa el mapa para filtrar por espacio.
          </p>
        </div>
        {canReserve && (
          <Button asChild className="shrink-0">
            <Link href="/reserva">Reservar</Link>
          </Button>
        )}
      </header>

      <CalendarClient
        reservations={reservations}
        maps={maps}
        spaces={spaces}
        areas={areas}
        isAdmin={admin}
        canReserve={canReserve}
        initialDate={params.date}
      />
    </section>
  );
}
