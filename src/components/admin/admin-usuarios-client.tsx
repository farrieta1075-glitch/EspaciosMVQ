"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserCog,
} from "lucide-react";
import type { Area } from "@/types/area";
import {
  USER_ROLE_LABELS,
  type PublicUser,
  type UserRole,
} from "@/types/user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { HelpHint } from "@/components/ui/help-hint";
import { cn } from "@/lib/utils";

interface AdminUsuariosClientProps {
  initialUsers: PublicUser[];
  areas: Area[];
  currentUserId: string;
}

interface UserFormState {
  email: string;
  username: string;
  password: string;
  role: UserRole;
  areaId: string;
  active: boolean;
}

const emptyForm: UserFormState = {
  email: "",
  username: "",
  password: "",
  role: "GENERAL",
  areaId: "",
  active: true,
};

export function AdminUsuariosClient({
  initialUsers,
  areas,
  currentUserId,
}: AdminUsuariosClientProps) {
  const router = useRouter();
  const [users, setUsers] = React.useState(initialUsers);
  const [form, setForm] = React.useState<UserFormState>(emptyForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deactivateId, setDeactivateId] = React.useState<string | null>(null);
  const [expandedIds, setExpandedIds] = React.useState<Record<string, boolean>>(
    {},
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [filterUsername, setFilterUsername] = React.useState("");
  const [filterRole, setFilterRole] = React.useState<UserRole | "">("");
  const [filterAreaId, setFilterAreaId] = React.useState("");

  const filteredUsers = users.filter((user) => {
    if (filterRole && user.role !== filterRole) return false;
    if (filterAreaId && user.areaId !== filterAreaId) return false;
    if (filterUsername.trim()) {
      const q = filterUsername.trim().toLowerCase();
      const username = (user.username ?? "").toLowerCase();
      const email = (user.email ?? "").toLowerCase();
      if (!username.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  async function refreshUsers() {
    const response = await fetch("/api/admin/usuarios");
    setUsers(await response.json());
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setCreateOpen(true);
  }

  function openEdit(user: PublicUser) {
    setEditingId(user.id);
    setForm({
      email: user.email ?? "",
      username: user.username ?? "",
      password: "",
      role: user.role,
      areaId: user.areaId ?? "",
      active: user.active,
    });
    setError(null);
    setEditOpen(true);
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      email: form.email.trim() || null,
      username: form.username.trim() || null,
      role: form.role,
      areaId: form.areaId || null,
      active: form.active,
      ...(form.password.trim() ? { password: form.password } : {}),
    };

    try {
      if (!payload.email && !payload.username) {
        throw new Error("Indica al menos un correo o nombre de usuario.");
      }

      if (form.role === "GENERAL" && !form.areaId) {
        throw new Error("Los usuarios General deben tener un área asignada.");
      }

      if (editingId) {
        const response = await fetch(`/api/admin/usuarios/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "No se pudo actualizar el usuario");
        }
        setEditOpen(false);
      } else {
        if (!form.password.trim()) {
          throw new Error("La contraseña es obligatoria al crear un usuario.");
        }
        const response = await fetch("/api/admin/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, password: form.password }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "No se pudo crear el usuario");
        }
        setCreateOpen(false);
      }

      setForm(emptyForm);
      setEditingId(null);
      await refreshUsers();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateId) return;
    if (deactivateId === currentUserId) {
      setError("No puedes desactivar tu propia cuenta.");
      setDeactivateId(null);
      return;
    }

    setLoading(true);
    setError(null);
    const response = await fetch(`/api/admin/usuarios/${deactivateId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo desactivar el usuario");
    } else {
      await refreshUsers();
    }
    setDeactivateId(null);
    setLoading(false);
  }

  function UserFormFields({ isEdit }: { isEdit: boolean }) {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor="userEmail">Correo</Label>
          <Input
            id="userEmail"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="userUsername">Usuario</Label>
          <Input
            id="userUsername"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="userPassword">
            Contraseña{isEdit ? " (opcional)" : ""}
          </Label>
          <Input
            id="userPassword"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!isEdit}
            minLength={isEdit ? undefined : 6}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="userRole">Rol</Label>
          <Select
            id="userRole"
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as UserRole })
            }
          >
            <option value="ADMIN">Administrador</option>
            <option value="GENERAL">General</option>
            <option value="VISUALIZACION">Visualización</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="userArea">Área</Label>
          <Select
            id="userArea"
            value={form.areaId}
            onChange={(e) => setForm({ ...form, areaId: e.target.value })}
          >
            <option value="">Sin área</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="rounded border-border"
            disabled={isEdit && editingId === currentUserId}
          />
          Usuario activo
        </label>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </Button>
        <HelpHint text="Define credenciales, rol y área de acceso." />
        <span className="text-sm text-muted-foreground">
          {filteredUsers.length} usuario(s)
        </span>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="filterUsername" className="text-xs">
            Buscar por usuario
          </Label>
          <Input
            id="filterUsername"
            value={filterUsername}
            onChange={(e) => setFilterUsername(e.target.value)}
            placeholder="Nombre de usuario o correo"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filterRole" className="text-xs">
            Rol
          </Label>
          <Select
            id="filterRole"
            value={filterRole}
            onChange={(e) =>
              setFilterRole(e.target.value as UserRole | "")
            }
          >
            <option value="">Todos</option>
            <option value="ADMIN">Administrador</option>
            <option value="GENERAL">General</option>
            <option value="VISUALIZACION">Visualización</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filterArea" className="text-xs">
            Área
          </Label>
          <Select
            id="filterArea"
            value={filterAreaId}
            onChange={(e) => setFilterAreaId(e.target.value)}
          >
            <option value="">Todas</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <UserCog className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No hay usuarios que coincidan con los filtros.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((user) => {
            const expanded = expandedIds[user.id];
            const title = user.username ?? user.email ?? user.id;
            return (
              <div
                key={user.id}
                className={cn(
                  "overflow-hidden rounded-lg border border-border",
                  !user.active && "opacity-75",
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
                  onClick={() => toggleExpanded(user.id)}
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {title}
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {USER_ROLE_LABELS[user.role]}
                  </Badge>
                </button>
                {expanded && (
                  <div className="space-y-3 border-t border-border px-3 py-3">
                    <p className="text-sm text-muted-foreground">
                      {user.email ?? "Sin correo"}
                      {user.username && user.email
                        ? ` · @${user.username}`
                        : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {user.areaName && (
                        <Badge variant="outline">{user.areaName}</Badge>
                      )}
                      {!user.active && (
                        <Badge variant="outline">Inactivo</Badge>
                      )}
                      {user.id === currentUserId && (
                        <Badge variant="outline">Tú</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="mr-1 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={!user.active || user.id === currentUserId}
                        onClick={() => setDeactivateId(user.id)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Desactivar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <UserFormFields isEdit={false} />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 gap-2">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Crear"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <UserFormFields isEdit />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deactivateId)}
        onOpenChange={(open) => !open && setDeactivateId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desactivar usuario</DialogTitle>
            <DialogDescription>
              El usuario no podrá iniciar sesión. ¿Continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDeactivateId(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              disabled={loading}
              onClick={confirmDeactivate}
            >
              Desactivar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
