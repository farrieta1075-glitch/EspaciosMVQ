import { getAllMaps } from "@/lib/sheets/maps";
import { getAllSpaces } from "@/lib/sheets/spaces";
import { AdminEspaciosClient } from "@/components/admin/admin-espacios-client";

export default async function AdminEspaciosPage() {
  const [maps, spaces] = await Promise.all([getAllMaps(), getAllSpaces()]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Espacios</h1>
        <p className="text-sm text-muted-foreground">
          Administra mapas de planta y espacios reservables.
        </p>
      </header>
      <AdminEspaciosClient initialMaps={maps} initialSpaces={spaces} />
    </section>
  );
}
