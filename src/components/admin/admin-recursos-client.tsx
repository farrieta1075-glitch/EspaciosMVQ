"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Space } from "@/types/space";
import type { Resource, ResourceScope, ResourceType } from "@/types/resource";
import {
  RESOURCE_SCOPE_LABELS,
  RESOURCE_TYPE_LABELS,
} from "@/types/resource";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AdminRecursosClientProps {
  initialResources: Resource[];
  spaces: Space[];
}

type FilterType = "ALL" | ResourceType;

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "TECNICO", label: "Técnicos" },
  { value: "CONSUMIBLE", label: "Consumibles" },
  { value: "OTRO", label: "Otros" },
];

interface ResourceFormState {
  name: string;
  type: ResourceType;
  totalQty: string;
  scope: ResourceScope;
  active: boolean;
  restrictedSpaceIds: string[];
  imageFile: File | null;
}

const emptyForm: ResourceFormState = {
  name: "",
  type: "TECNICO",
  totalQty: "1",
  scope: "GLOBAL",
  active: true,
  restrictedSpaceIds: [],
  imageFile: null,
};

export function AdminRecursosClient({
  initialResources,
  spaces,
}: AdminRecursosClientProps) {
  const router = useRouter();
  const [resources, setResources] = React.useState(initialResources);
  const [filter, setFilter] = React.useState<FilterType>("ALL");
  const [form, setForm] = React.useState<ResourceFormState>(emptyForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filteredResources = resources.filter(
    (resource) => filter === "ALL" || resource.type === filter,
  );

  async function refreshResources() {
    const response = await fetch("/api/admin/recursos");
    setResources(await response.json());
  }

  function toggleSpace(spaceId: string) {
    setForm((current) => ({
      ...current,
      restrictedSpaceIds: current.restrictedSpaceIds.includes(spaceId)
        ? current.restrictedSpaceIds.filter((id) => id !== spaceId)
        : [...current.restrictedSpaceIds, spaceId],
    }));
  }

  function startEdit(resource: Resource) {
    setEditingId(resource.id);
    setForm({
      name: resource.name,
      type: resource.type,
      totalQty: String(resource.totalQty),
      scope: resource.scope,
      active: resource.active,
      restrictedSpaceIds: resource.restrictedSpaceIds,
      imageFile: null,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function uploadImage(resourceId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("resourceId", resourceId);

    const response = await fetch("/api/admin/recursos/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("No se pudo subir la imagen");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      type: form.type,
      totalQty: Number(form.totalQty) || 0,
      scope: form.scope,
      active: form.active,
      restrictedSpaceIds:
        form.scope === "RESTRICTED" ? form.restrictedSpaceIds : [],
    };

    try {
      if (form.scope === "RESTRICTED" && payload.restrictedSpaceIds.length === 0) {
        throw new Error("Selecciona al menos un espacio para recursos restringidos.");
      }

      if (editingId) {
        const response = await fetch(`/api/admin/recursos/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "No se pudo actualizar el recurso");
        }
        if (form.imageFile) {
          await uploadImage(editingId, form.imageFile);
        }
      } else {
        const response = await fetch("/api/admin/recursos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "No se pudo crear el recurso");
        }
        const created: Resource = await response.json();
        if (form.imageFile) {
          await uploadImage(created.id, form.imageFile);
        }
      }

      cancelEdit();
      await refreshResources();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este recurso?")) return;
    setLoading(true);
    await fetch(`/api/admin/recursos/${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await refreshResources();
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={filter === option.value ? "default" : "outline"}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
            <span className="ml-1.5 text-xs opacity-70">
              (
              {option.value === "ALL"
                ? resources.length
                : resources.filter((r) => r.type === option.value).length}
              )
            </span>
          </Button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingId ? (
                <>
                  <Pencil className="h-5 w-5" />
                  Editar recurso
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Nuevo recurso
                </>
              )}
            </CardTitle>
            <CardDescription>
              Clasifica, define cantidad y restricciones de uso por espacio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resourceName">Nombre</Label>
                <Input
                  id="resourceName"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Proyector 4K"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="resourceType">Tipo</Label>
                  <Select
                    id="resourceType"
                    value={form.type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        type: e.target.value as ResourceType,
                      })
                    }
                  >
                    <option value="TECNICO">Técnico</option>
                    <option value="CONSUMIBLE">Consumible</option>
                    <option value="OTRO">Otro</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resourceQty">Cantidad total</Label>
                  <Input
                    id="resourceQty"
                    type="number"
                    min={0}
                    value={form.totalQty}
                    onChange={(e) =>
                      setForm({ ...form, totalQty: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resourceScope">Disponibilidad</Label>
                <Select
                  id="resourceScope"
                  value={form.scope}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      scope: e.target.value as ResourceScope,
                      restrictedSpaceIds:
                        e.target.value === "GLOBAL"
                          ? []
                          : form.restrictedSpaceIds,
                    })
                  }
                >
                  <option value="GLOBAL">Global (todos los espacios)</option>
                  <option value="RESTRICTED">Restringido a espacios</option>
                </Select>
              </div>

              {form.scope === "RESTRICTED" && (
                <div className="space-y-2">
                  <Label>Espacios permitidos</Label>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    {spaces.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No hay espacios registrados. Créalos en Espacios.
                      </p>
                    ) : (
                      spaces.map((space) => (
                        <label
                          key={space.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60"
                        >
                          <input
                            type="checkbox"
                            checked={form.restrictedSpaceIds.includes(space.id)}
                            onChange={() => toggleSpace(space.id)}
                            className="rounded border-border"
                          />
                          <span className="truncate">{space.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="resourceImage">Imagen</Label>
                <Input
                  id="resourceImage"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      imageFile: e.target.files?.[0] ?? null,
                    })
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                  className="rounded border-border"
                />
                Recurso activo
              </label>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1 gap-2">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingId ? (
                    "Guardar cambios"
                  ) : (
                    "Crear recurso"
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
          {filteredResources.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Package className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No hay recursos en esta categoría.
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredResources.map((resource) => (
              <Card
                key={resource.id}
                className={cn(
                  editingId === resource.id && "ring-2 ring-primary",
                )}
              >
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {resource.imageUrl ? (
                      <Image
                        src={resource.imageUrl}
                        alt={resource.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium">{resource.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Cantidad disponible: {resource.totalQty}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(resource)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(resource.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {RESOURCE_TYPE_LABELS[resource.type]}
                      </Badge>
                      <Badge variant="outline">
                        {RESOURCE_SCOPE_LABELS[resource.scope]}
                      </Badge>
                      {!resource.active && (
                        <Badge variant="outline">Inactivo</Badge>
                      )}
                    </div>

                    {resource.scope === "RESTRICTED" &&
                      resource.restrictedSpaceIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Espacios:{" "}
                          {resource.restrictedSpaceIds
                            .map(
                              (id) =>
                                spaces.find((s) => s.id === id)?.name ?? id,
                            )
                            .join(", ")}
                        </p>
                      )}
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
