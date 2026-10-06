import { getAllMaps } from "@/lib/sheets/maps";
import { getAllSpaces } from "@/lib/sheets/spaces";
import { AdminEspaciosClient } from "@/components/admin/admin-espacios-client";

export default async function AdminEspaciosPage() {
  const [maps, spaces] = await Promise.all([getAllMaps(), getAllSpaces()]);

  return (
    <section className="space-y-6">
      <AdminEspaciosClient initialMaps={maps} initialSpaces={spaces} />
    </section>
  );
}
