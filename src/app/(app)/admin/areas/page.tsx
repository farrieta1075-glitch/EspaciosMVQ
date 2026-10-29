import { getAllAreas } from "@/lib/sheets/areas";
import { AdminAreasClient } from "@/components/admin/admin-areas-client";
import { HelpHint } from "@/components/ui/help-hint";

export default async function AdminAreasPage() {
  const areas = await getAllAreas();

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Áreas</h1>
        <HelpHint text="Áreas, subáreas y listas de eventos precargados por perfil." />
      </header>
      <AdminAreasClient initialAreas={areas} />
    </section>
  );
}
