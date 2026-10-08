"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Eye,
  EyeOff,
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
  receiveApprovalEmails: boolean;
}

const emptyForm: UserFormState = {
  email: "",
  username: "",
  password: "",
  role: "GENERAL",
  areaId: "",
  active: true,
  receiveApprovalEmails: true,
};

interface UserFormFieldsProps {
  formIdPrefix: "create" | "edit";
  isEdit: boolean;
  form: UserFormState;
  onPatch: (patch: Partial<UserFormState>) => void;
  areas: Area[];
  editingId: string | null;
  currentUserId: string;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  editPasswordConfigured: boolean;
}

function UserFormFields({
  formIdPrefix,
  isEdit,
  form,
  onPatch,
  areas,
  editingId,
  currentUserId,
  showPassword,
  onToggleShowPassword,
  editPasswordConfigured,
}: UserFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${formIdPrefix}-userEmail`}>Correo</Label>
        <Input
          id={`${formIdPrefix}-userEmail`}
          type="email"
          value={form.email}
          onChange={(e) => onPatch({ email: e.target.value })}
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${formIdPrefix}-userUsername`}>Usuario</Label>
        <Input
          id={`${formIdPrefix}-userUsername`}
          value={form.username}
          onChange={(e) => onPatch({ username: e.target.value })}
          autoComplete="username"
        />
      </div>
      {isEdit && editPasswordConfigured && !form.password && (
        <p className="text-xs text-muted-foreground">
          Este usuario ya tiene contraseña configurada (no se puede recuperar).
          Escribe una nueva abajo para cambiarla.
        </p>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${formIdPrefix}-userPassword`}>
            {isEdit ? "Nueva contraseña (opcional)" : "Contraseña"}
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
            onClick={onToggleShowPassword}
          >
            {showPassword ? (
              <>
                <EyeOff className="mr-1 h-3.5 w-3.5" />
                Ocultar
              </>
            ) : (
              <>
                <Eye className="mr-1 h-3.5 w-3.5" />
                Ver contraseña
              </>
            )}
          </Button>
        </div>
        <div className="relative">
          <Input
            id={`${formIdPrefix}-userPassword`}
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={(e) => onPatch({ password: e.target.value })}
            required={!isEdit}
            minLength={isEdit ? undefined : 6}
            className="pr-10"
            autoComplete="new-password"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full w-10"
            onClick={onToggleShowPassword}
            aria-label={
              showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${formIdPrefix}-userRole`}>Rol</Label>
        <Select
          id={`${formIdPrefix}-userRole`}
          value={form.role}
          onChange={(e) => {
            const role = e.target.value as UserRole;
            onPatch({
              role,
              receiveApprovalEmails:
                role === "ADMIN" ? form.receiveApprovalEmails : false,
            });
          }}
        >
          <option value="ADMIN">Administrador</option>
          <option value="GENERAL">General</option>
          <option value="VISUALIZACION">Visualización</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${formIdPrefix}-userArea`}>Área</Label>
        <Select
          id={`${formIdPrefix}-userArea`}
          value={form.areaId}
          onChange={(e) => onPatch({ areaId: e.target.value })}
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
          onChange={(e) => onPatch({ active: e.target.checked })}
          className="rounded border-border"
          disabled={isEdit && editingId === currentUserId}
        />
        Usuario activo
      </label>
      {form.role === "ADMIN" && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.receiveApprovalEmails}
            onChange={(e) =>
              onPatch({ receiveApprovalEmails: e.target.checked })
            }
            className="mt-0.5 rounded border-border"
          />
          <span>
            Recibir correos para autorizar reservas (nuevas, cambios y
            cancelaciones)
          </span>
        </label>
      )}
    </>
  );
}

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
  const [showPassword, setShowPassword] = React.useState(false);
  const [editPasswordConfigured, setEditPasswordConfigured] =
    React.useState(false);

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
      receiveApprovalEmails: user.receiveApprovalEmails,
    });
    setEditPasswordConfigured(Boolean(user.passwordConfigured));
    setShowPassword(false);
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
      ...(form.role === "ADMIN"
        ? { receiveApprovalEmails: form.receiveApprovalEmails }
        : {}),
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

  const patchForm = React.useCallback((patch: Partial<UserFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const toggleShowPassword = React.useCallback(() => {
    setShowPassword((value) => !value);
  }, []);

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
                      {user.role === "ADMIN" && (
                        <Badge variant="outline">
                          Correos autorización:{" "}
                          {user.receiveApprovalEmails ? "Sí" : "No"}
                        </Badge>
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
            <UserFormFields
              formIdPrefix="create"
              isEdit={false}
              form={form}
              onPatch={patchForm}
              areas={areas}
              editingId={editingId}
              currentUserId={currentUserId}
              showPassword={showPassword}
              onToggleShowPassword={toggleShowPassword}
              editPasswordConfigured={editPasswordConfigured}
            />
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
            <UserFormFields
              formIdPrefix="edit"
              isEdit
              form={form}
              onPatch={patchForm}
              areas={areas}
              editingId={editingId}
              currentUserId={currentUserId}
              showPassword={showPassword}
              onToggleShowPassword={toggleShowPassword}
              editPasswordConfigured={editPasswordConfigured}
            />
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
