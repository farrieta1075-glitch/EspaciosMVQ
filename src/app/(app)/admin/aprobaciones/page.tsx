import { getAllAreas } from "@/lib/sheets/areas";
import { listPendingReservationDetails } from "@/lib/reservation-service";
import { AdminApprovalsClient } from "@/components/admin/admin-approvals-client";

export default async function AdminApprovalsPage() {
  const [areas, reservations] = await Promise.all([
    getAllAreas(),
    listPendingReservationDetails(),
  ]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Aprobaciones</h1>
        <p className="text-sm text-muted-foreground">
          Autoriza o rechaza reservas nuevas, cambios y cancelaciones solicitadas por las áreas.
        </p>
      </header>
      <AdminApprovalsClient initialReservations={reservations} areas={areas} />
    </section>
  );
}
