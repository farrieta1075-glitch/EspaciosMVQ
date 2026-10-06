import { getAllResources } from "@/lib/sheets/resources";
import { getAllSpaces } from "@/lib/sheets/spaces";
import { AdminRecursosClient } from "@/components/admin/admin-recursos-client";
import { HelpHint } from "@/components/ui/help-hint";

export default async function AdminRecursosPage() {
  const [resources, spaces] = await Promise.all([
    getAllResources(),
    getAllSpaces(),
  ]);

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Recursos</h1>
        <HelpHint text="Administra recursos técnicos, consumibles y otros. Define cantidad y restricciones por espacio." />
      </header>
      <AdminRecursosClient initialResources={resources} spaces={spaces} />
    </section>
  );
}
