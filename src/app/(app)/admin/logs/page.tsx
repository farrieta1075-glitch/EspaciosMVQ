import { AdminLogsClient } from "@/components/admin/admin-logs-client";
import { HelpHint } from "@/components/ui/help-hint";

export default function AdminLogsPage() {
  return (
    <section className="space-y-6">
      <header className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Logs de actividad
        </h1>
        <HelpHint text="Inicios de sesión y uso de la app por usuarios General, aunque no cierren sesión." />
      </header>
      <AdminLogsClient />
    </section>
  );
}
