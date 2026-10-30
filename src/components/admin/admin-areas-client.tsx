"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { Area } from "@/types/area";
import { buildAreaHierarchy } from "@/lib/area-scope";
import { getAreaHex } from "@/lib/area-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { HelpHint } from "@/components/ui/help-hint";
interface AdminAreasClientProps {
  initialAreas: Area[];
}

interface AreaFormState {
  name: string;
  code: string;
  parentId: string;
  colorHex: string;
  eventPresetsText: string;
}

const emptyForm: AreaFormState = {
  name: "",
  code: "",
  parentId: "",
  colorHex: "",
  eventPresetsText: "",
};

function presetsToText(presets: string[]): string {
  return presets.join("\n");
}

function textToPresets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function subareaCountLabel(count: number): string {
  if (count === 0) return "Sin subáreas";
  if (count === 1) return "1 subárea";
  return `${count} subáreas`;
}

export function AdminAreasClient({ initialAreas }: AdminAreasClientProps) {
  const router = useRouter();
  const [areas, setAreas] = React.useState(initialAreas);
  const [form, setForm] = React.useState<AreaFormState>(emptyForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedIds, setExpandedIds] = React.useState<Record<string, boolean>>(
    {},
  );

  const { areasById, childrenByParent, roots } = React.useMemo(
    () => buildAreaHierarchy(areas),
    [areas],
  );

  async function refreshAreas() {
    const response = await fetch("/api/admin/areas");
    if (response.ok) setAreas(await response.json());
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function openCreate(parentId?: string) {
    setEditingId(null);
    setForm({ ...emptyForm, parentId: parentId ?? "" });
    setError(null);
    setDialogOpen(true);
    if (parentId) {
      setExpandedIds((current) => ({ ...current, [parentId]: true }));
    }
  }

  function openEdit(area: Area) {
    setEditingId(area.id);
    setForm({
      name: area.name,
      code: area.code ?? "",
      parentId: area.parentId ?? "",
      colorHex: area.colorHex ?? "",
      eventPresetsText: presetsToText(area.eventPresets ?? []),
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      parentId: form.parentId || null,
      colorHex: form.colorHex.trim(),
      eventPresets: textToPresets(form.eventPresetsText),
    };

    try {
      const response = await fetch(
        editingId ? `/api/admin/areas/${editingId}` : "/api/admin/areas",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo guardar el área");
      }
      setDialogOpen(false);
      await refreshAreas();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(area: Area) {
    if (
      !confirm(
        `¿Eliminar "${area.name}"? Solo es posible si no tiene subáreas.`,
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/admin/areas/${area.id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "No se pudo eliminar");
    } else {
      await refreshAreas();
      router.refresh();
    }
    setLoading(false);
  }

  function renderSubareaRow(area: Area) {
    const hex = getAreaHex(area, areas);
    const presetCount = area.eventPresets?.length ?? 0;

    return (
      <div
        key={area.id}
        className="flex items-start gap-2 border-t border-border bg-muted/20 py-2 pl-8 pr-3 sm:pl-10"
      >
        <span
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border"
          style={{ backgroundColor: hex }}
        />
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium leading-snug">{area.name}</p>
              <Badge variant="outline" className="text-[10px]">
                Subárea
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {presetCount > 0
                ? `${presetCount} evento(s) precargado(s)`
                : "Sin eventos precargados"}
            </p>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => openEdit(area)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
              onClick={() => handleDelete(area)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderRootArea(area: Area) {
    const children = childrenByParent.get(area.id) ?? [];
    const expanded = expandedIds[area.id] ?? false;
    const hex = getAreaHex(area, areas);
    const isRoot = !area.parentId;

    return (
      <div
        key={area.id}
        className="overflow-hidden rounded-lg border border-border"
      >
        <div className="flex items-start gap-2 px-3 py-3">
          {isRoot ? (
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted/60"
              onClick={() => toggleExpanded(area.id)}
              aria-expanded={expanded}
              aria-label={expanded ? "Ocultar subáreas" : "Mostrar subáreas"}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-8 shrink-0" />
          )}
          <span
            className="mt-2.5 h-3 w-3 shrink-0 rounded-full ring-1 ring-border"
            style={{ backgroundColor: hex }}
          />
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <div className="min-w-0 flex-1">
              {isRoot ? (
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => toggleExpanded(area.id)}
                >
                  <p className="font-medium leading-snug">{area.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {subareaCountLabel(children.length)}
                    {(area.eventPresets?.length ?? 0) > 0
                      ? ` · ${area.eventPresets.length} evento(s) en área`
                      : ""}
                  </p>
                </button>
              ) : (
                <>
                  <p className="font-medium leading-snug">{area.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Subárea sin área padre en hoja
                  </p>
                </>
              )}
            </div>
            <div className="flex shrink-0 gap-0.5 self-start">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => openEdit(area)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive"
                onClick={() => handleDelete(area)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        {isRoot && expanded && (
          <div className="border-t border-border bg-muted/10">
            {children.map((child) => renderSubareaRow(child))}
            <div className="border-t border-border px-3 py-2 pl-8 sm:pl-14">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-full justify-start sm:w-auto"
                onClick={() => openCreate(area.id)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Subárea
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const parentOptions = areas.filter((area) => area.id !== editingId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="gap-2" onClick={() => openCreate()}>
          <Plus className="h-4 w-4" />
          Nueva área
        </Button>
        <HelpHint text="Organiza áreas y subáreas. En subáreas puedes precargar nombres de evento para reservas." />
        <span className="text-sm text-muted-foreground">
          {areas.length} registro(s)
        </span>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {roots.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <Layers className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aún no hay áreas. Crea la primera (ej. Formación).
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {roots.map((area) => renderRootArea(area))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar área" : "Nueva área"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="areaName">Nombre</Label>
              <Input
                id="areaName"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="areaCode">Código</Label>
                <Input
                  id="areaCode"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="areaColor">Color (#RRGGBB)</Label>
                <Input
                  id="areaColor"
                  value={form.colorHex}
                  placeholder={
                    form.parentId ? "Heredado del área padre" : "#4A235A"
                  }
                  onChange={(e) =>
                    setForm({ ...form, colorHex: e.target.value })
                  }
                />
                {form.parentId ? (
                  <p className="text-xs text-muted-foreground">
                    Las subáreas usan el color del padre en tonos más claros. Deja
                    vacío para heredar o escribe un código para personalizar.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaParent">Área padre (opcional)</Label>
              <Select
                id="areaParent"
                value={form.parentId}
                onChange={(e) =>
                  setForm({ ...form, parentId: e.target.value })
                }
              >
                <option value="">Ninguna (área raíz)</option>
                {parentOptions
                  .filter((area) => !area.parentId)
                  .map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaPresets">
                Eventos precargados (uno por línea)
              </Label>
              <textarea
                id="areaPresets"
                value={form.eventPresetsText}
                onChange={(e) =>
                  setForm({ ...form, eventPresetsText: e.target.value })
                }
                rows={6}
                placeholder={"Alpha\nRetiro Alpha\nSanidad Emocional"}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
