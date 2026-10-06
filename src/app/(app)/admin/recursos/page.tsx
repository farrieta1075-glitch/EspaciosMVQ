import { getAllResources } from "@/lib/sheets/resources";
import { getAllSpaces } from "@/lib/sheets/spaces";
import { AdminRecursosClient } from "@/components/admin/admin-recursos-client";

export default async function AdminRecursosPage() {
  const [resources, spaces] = await Promise.all([
    getAllResources(),
    getAllSpaces(),
  ]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Recursos</h1>
        <p className="text-sm text-muted-foreground">
          Administra recursos técnicos, consumibles y otros. Define cantidad e
          restricciones por espacio.
        </p>
      </header>
      <AdminRecursosClient initialResources={resources} spaces={spaces} />
    </section>
  );
}
