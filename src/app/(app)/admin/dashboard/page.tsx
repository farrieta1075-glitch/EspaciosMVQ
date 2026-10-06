import { getDashboardStats } from "@/lib/dashboard-metrics";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Estadísticas de uso de espacios, recursos y reservas.
        </p>
      </header>
      <AdminDashboardClient initialStats={stats} />
    </section>
  );
}
