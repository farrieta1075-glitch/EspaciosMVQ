import { auth } from "@/lib/auth";
import { getAllAreas } from "@/lib/sheets/areas";
import { getAllUserRecords } from "@/lib/sheets/users";
import { AdminUsuariosClient } from "@/components/admin/admin-usuarios-client";
import { HelpHint } from "@/components/ui/help-hint";
import type { PublicUser } from "@/types/user";

export default async function AdminUsuariosPage() {
  const session = await auth();
  const [users, areas] = await Promise.all([
    getAllUserRecords(),
    getAllAreas(),
  ]);

  const areaMap = new Map(areas.map((area) => [area.id, area.name]));
  const publicUsers: PublicUser[] = users.map((user) => ({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    areaId: user.areaId,
    active: user.active,
    receiveApprovalEmails: user.receiveApprovalEmails,
    passwordConfigured: Boolean(user.passwordHash),
    areaName: user.areaId ? areaMap.get(user.areaId) ?? null : null,
  }));

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <HelpHint text="Administra cuentas, roles y áreas de acceso." />
      </header>
      <AdminUsuariosClient
        initialUsers={publicUsers}
        areas={areas}
        currentUserId={session?.user?.id ?? ""}
      />
    </section>
  );
}
