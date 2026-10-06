import Link from "next/link";
import { auth } from "@/lib/auth/index";
import { isAdmin } from "@/lib/auth/permissions";
import { listReservationDetails } from "@/lib/reservation-service";
import { ReservationsList } from "@/components/reservation/reservations-list";
import { Button } from "@/components/ui/button";

export default async function ReservasPage() {
  const session = await auth();
  const admin = isAdmin(session?.user ?? null);

  const reservations = await listReservationDetails(
    session?.user?.areaId ?? null,
    admin,
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {admin ? "Todas las reservas" : "Mis reservas"}
        </h1>
        <Button asChild className="shrink-0">
          <Link href="/reserva">Nueva reserva</Link>
        </Button>
      </header>

      <ReservationsList
        initialReservations={reservations}
        isAdmin={admin}
      />
    </section>
  );
}
