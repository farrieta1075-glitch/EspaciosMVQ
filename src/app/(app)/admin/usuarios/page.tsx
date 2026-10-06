import { auth } from "@/lib/auth";
import { getAllAreas } from "@/lib/sheets/areas";
import { getAllUserRecords } from "@/lib/sheets/users";
import { AdminUsuariosClient } from "@/components/admin/admin-usuarios-client";
import type { PublicUser } from "@/types/user";

export default async function AdminUsuariosPage() {
  const session = await auth();
  const [users, areas] = await Promise.all([
    getAllUserRecords(),
    getAllAreas(),
  ]);

  const areaMap = new Map(areas.map((area) => [area.id, area.name]));
  const publicUsers: PublicUser[] = users.map((user) => {
    const { passwordHash: _passwordHash, ...rest } = user;
    return {
      ...rest,
      areaName: user.areaId ? areaMap.get(user.areaId) ?? null : null,
    };
  });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Administra cuentas, roles y áreas de acceso.
        </p>
      </header>
      <AdminUsuariosClient
        initialUsers={publicUsers}
        areas={areas}
        currentUserId={session?.user?.id ?? ""}
      />
    </section>
  );
}
