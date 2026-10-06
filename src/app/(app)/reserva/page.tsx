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
    <section className="space-y-3">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {readOnly ? "Consulta de espacios" : "Nueva reserva"}
        </h1>
        {readOnly && (
          <p className="text-sm text-muted-foreground">
            Consulta disponibilidad de espacios y recursos.
          </p>
        )}
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
