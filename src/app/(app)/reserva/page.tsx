import { auth } from "@/lib/auth/index";
import { can, isAdmin } from "@/lib/auth/permissions";
import { getCachedCatalogBundle } from "@/lib/sheets/cached-catalog";
import { MapDateSelectorWrapper } from "@/components/map-date/map-date-selector-wrapper";
import { ReservationFlow } from "@/components/reservation/reservation-flow";

export default async function ReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  const readOnly = !can(session?.user ?? null, "create:reservation");
  const admin = isAdmin(session?.user ?? null);
  const params = await searchParams;

  const [maps, spaces, areas] = await getCachedCatalogBundle();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {readOnly ? "Consulta de espacios" : "Nueva reserva"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "Consulta disponibilidad de espacios y recursos."
            : "Completa el flujo: espacios → periodo → recursos → datos del evento."}
        </p>
      </header>

      {readOnly ? (
        <MapDateSelectorWrapper
          maps={maps}
          spaces={spaces}
          initialDate={params.date}
          showResourcePanel={false}
          showCalendarLink
          readOnly
        />
      ) : (
        <ReservationFlow
          maps={maps}
          spaces={spaces}
          areas={areas}
          isAdmin={admin}
          userAreaId={session?.user?.areaId ?? null}
          initialDate={params.date}
        />
      )}
    </section>
  );
}
