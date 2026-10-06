"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2, UserCog, X } from "lucide-react";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const [showInactive, setShowInactive] = React.useState(true);
  const [form, setForm] = React.useState<UserFormState>(emptyForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filteredUsers = users.filter(
    (user) => showInactive || user.active,
  );

  async function refreshUsers() {
    const response = await fetch("/api/admin/usuarios");
    setUsers(await response.json());
  }

  function startEdit(user: PublicUser) {
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
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
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
      }

      cancelEdit();
      await refreshUsers();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (id === currentUserId) {
      setError("No puedes desactivar tu propia cuenta.");
      return;
    }
    if (!confirm("¿Desactivar este usuario?")) return;

    setLoading(true);
    setError(null);
    const response = await fetch(`/api/admin/usuarios/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo desactivar el usuario");
    } else {
      if (editingId === id) cancelEdit();
      await refreshUsers();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={showInactive ? "default" : "outline"}
          onClick={() => setShowInactive((current) => !current)}
        >
          {showInactive ? "Ocultar inactivos" : "Mostrar inactivos"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {filteredUsers.length} usuario(s)
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingId ? (
                <>
                  <Pencil className="h-5 w-5" />
                  Editar usuario
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Nuevo usuario
                </>
              )}
              <HelpHint text="Define credenciales, rol y área de acceso." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userEmail">Correo</Label>
                <Input
                  id="userEmail"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@empresa.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="userUsername">Usuario</Label>
                <Input
                  id="userUsername"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="nombre.usuario"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="userPassword">
                  Contraseña{editingId ? " (opcional)" : ""}
                </Label>
                <Input
                  id="userPassword"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editingId ? "Dejar en blanco para no cambiar" : "Mínimo 6 caracteres"}
                  required={!editingId}
                  minLength={editingId ? undefined : 6}
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
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                  className="rounded border-border"
                  disabled={editingId === currentUserId}
                />
                Usuario activo
              </label>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1 gap-2">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingId ? (
                    "Guardar cambios"
                  ) : (
                    "Crear usuario"
                  )}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelEdit}
                    disabled={loading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <UserCog className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No hay usuarios registrados.
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredUsers.map((user) => (
              <Card
                key={user.id}
                className={cn(
                  editingId === user.id && "ring-2 ring-primary",
                  !user.active && "opacity-70",
                )}
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div>
                      <h3 className="font-medium">
                        {user.username ?? user.email ?? user.id}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {user.email ?? "Sin correo"}
                        {user.username && user.email ? ` · @${user.username}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {USER_ROLE_LABELS[user.role]}
                      </Badge>
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
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(user)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeactivate(user.id)}
                      disabled={loading || user.id === currentUserId || !user.active}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
