"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Map,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { HelpHint } from "@/components/ui/help-hint";
import type { FloorMap, Space } from "@/types/space";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
interface AdminEspaciosClientProps {
  initialMaps: FloorMap[];
  initialSpaces: Space[];
}

export function AdminEspaciosClient({
  initialMaps,
  initialSpaces,
}: AdminEspaciosClientProps) {
  const router = useRouter();
  const [maps, setMaps] = React.useState(initialMaps);
  const [spaces, setSpaces] = React.useState(initialSpaces);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [mapName, setMapName] = React.useState("");
  const [mapType, setMapType] = React.useState<"blank" | "image" | "pdf">(
    "blank",
  );
  const [mapFile, setMapFile] = React.useState<File | null>(null);

  const [spaceName, setSpaceName] = React.useState("");
  const [spaceFloor, setSpaceFloor] = React.useState("");
  const [spaceCapacity, setSpaceCapacity] = React.useState("10");
  const [spaceMinCapacity, setSpaceMinCapacity] = React.useState("1");
  const [spaceMapId, setSpaceMapId] = React.useState(maps[0]?.id ?? "");
  const [mapsSectionOpen, setMapsSectionOpen] = React.useState(false);
  const [spacesSectionOpen, setSpacesSectionOpen] = React.useState(false);
  const [createSpaceOpen, setCreateSpaceOpen] = React.useState(false);
  const [editSpace, setEditSpace] = React.useState<Space | null>(null);
  const [deleteSpaceId, setDeleteSpaceId] = React.useState<string | null>(null);
  const [expandedSpaceIds, setExpandedSpaceIds] = React.useState<
    Record<string, boolean>
  >({});

  const [editSpaceName, setEditSpaceName] = React.useState("");
  const [editSpaceFloor, setEditSpaceFloor] = React.useState("");
  const [editSpaceCapacity, setEditSpaceCapacity] = React.useState("10");
  const [editSpaceMinCapacity, setEditSpaceMinCapacity] = React.useState("1");
  const [editSpaceMapId, setEditSpaceMapId] = React.useState("");
  const [editSpaceActive, setEditSpaceActive] = React.useState(true);

  React.useEffect(() => {
    if (!spaceMapId && maps[0]?.id) setSpaceMapId(maps[0].id);
  }, [maps, spaceMapId]);

  async function refreshData() {
    const [mapsRes, spacesRes] = await Promise.all([
      fetch("/api/admin/mapas"),
      fetch("/api/admin/espacios"),
    ]);
    setMaps(await mapsRes.json());
    setSpaces(await spacesRes.json());
  }

  async function handleCreateMap(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/mapas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: mapName,
          backgroundType: mapType,
          width: 900,
          height: 650,
        }),
      });

      if (!response.ok) throw new Error("No se pudo crear el mapa");
      const created: FloorMap = await response.json();

      if (mapFile && mapType !== "blank") {
        const formData = new FormData();
        formData.append("file", mapFile);
        formData.append("mapId", created.id);
        formData.append("backgroundType", mapType);

        const uploadRes = await fetch("/api/admin/mapas/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("No se pudo subir el archivo");
      }

      setMapName("");
      setMapFile(null);
      await refreshData();
      router.push(`/admin/espacios/mapas/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear mapa");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSpace(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/espacios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: spaceName,
          floor: spaceFloor,
          capacity: Number(spaceCapacity) || 0,
          minCapacity: Number(spaceMinCapacity) || 1,
          mapId: spaceMapId,
          active: true,
        }),
      });

      if (!response.ok) throw new Error("No se pudo crear el espacio");

      setSpaceName("");
      setSpaceFloor("");
      setSpaceCapacity("10");
      setSpaceMinCapacity("1");
      setCreateSpaceOpen(false);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear espacio");
    } finally {
      setLoading(false);
    }
  }

  function openEditSpace(space: Space) {
    setEditSpace(space);
    setEditSpaceName(space.name);
    setEditSpaceFloor(space.floor);
    setEditSpaceCapacity(String(space.capacity));
    setEditSpaceMinCapacity(String(space.minCapacity));
    setEditSpaceMapId(space.mapId);
    setEditSpaceActive(space.active);
  }

  async function handleUpdateSpace(event: React.FormEvent) {
    event.preventDefault();
    if (!editSpace) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/espacios/${editSpace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editSpaceName,
          floor: editSpaceFloor,
          capacity: Number(editSpaceCapacity) || 0,
          minCapacity: Number(editSpaceMinCapacity) || 1,
          mapId: editSpaceMapId,
          active: editSpaceActive,
        }),
      });
      if (!response.ok) throw new Error("No se pudo actualizar el espacio");
      setEditSpace(null);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDeleteSpace() {
    if (!deleteSpaceId) return;
    setLoading(true);
    setError(null);
    await fetch(`/api/admin/espacios/${deleteSpaceId}`, { method: "DELETE" });
    setDeleteSpaceId(null);
    await refreshData();
    setLoading(false);
  }

  function toggleSpaceExpanded(id: string) {
    setExpandedSpaceIds((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  async function handleDeleteMap(id: string) {
    if (!confirm("¿Eliminar este mapa? Los espacios no se borran automáticamente."))
      return;
    setLoading(true);
    await fetch(`/api/admin/mapas/${id}`, { method: "DELETE" });
    await refreshData();
    setLoading(false);
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Espacios</h1>
        <HelpHint text="Administra mapas de planta y espacios reservables." />
      </header>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              onClick={() => setMapsSectionOpen((open) => !open)}
              aria-expanded={mapsSectionOpen}
            >
              {mapsSectionOpen ? (
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <Map className="h-5 w-5 shrink-0" />
              <CardTitle className="flex flex-1 items-center gap-2 text-lg">
                Mapas de planta
                <HelpHint text="Crea un lienzo en blanco o sube PNG/JPG/PDF como fondo." />
              </CardTitle>
            </button>
          </CardHeader>
          {mapsSectionOpen && (
          <CardContent>
            <form onSubmit={handleCreateMap} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mapName">Nombre del mapa</Label>
                <Input
                  id="mapName"
                  value={mapName}
                  onChange={(e) => setMapName(e.target.value)}
                  placeholder="Planta baja"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mapType">Tipo de fondo</Label>
                <Select
                  id="mapType"
                  value={mapType}
                  onChange={(e) =>
                    setMapType(e.target.value as "blank" | "image" | "pdf")
                  }
                >
                  <option value="blank">Lienzo en blanco</option>
                  <option value="image">Imagen (PNG/JPG)</option>
                  <option value="pdf">PDF (primera página)</option>
                </Select>
              </div>
              {mapType !== "blank" && (
                <div className="space-y-2">
                  <Label htmlFor="mapFile">Archivo</Label>
                  <Input
                    id="mapFile"
                    type="file"
                    accept={
                      mapType === "pdf" ? "application/pdf" : "image/png,image/jpeg,image/webp"
                    }
                    onChange={(e) => setMapFile(e.target.files?.[0] ?? null)}
                    required
                  />
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Crear mapa
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              {maps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hay mapas. Crea uno para delimitar espacios.
                </p>
              ) : (
                maps.map((map) => (
                  <div
                    key={map.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{map.name}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="secondary">{map.backgroundType}</Badge>
                        <Badge variant="outline">
                          {map.width}×{map.height}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/espacios/mapas/${map.id}`}>
                          <Pencil className="mr-1 h-4 w-4" />
                          Editor
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteMap(map.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              onClick={() => setSpacesSectionOpen((open) => !open)}
              aria-expanded={spacesSectionOpen}
            >
              {spacesSectionOpen ? (
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <CardTitle className="flex flex-1 items-center gap-2 text-lg">
                Espacios reservables
                <HelpHint text="Define espacios y luego delímitalos en el editor gráfico." />
              </CardTitle>
            </button>
          </CardHeader>
          {spacesSectionOpen && (
          <CardContent className="space-y-4">
            <Button
              type="button"
              className="w-full gap-2"
              disabled={maps.length === 0}
              onClick={() => setCreateSpaceOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Agregar nuevo espacio
            </Button>

            {spaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay espacios registrados.
              </p>
            ) : (
              <div className="space-y-2">
                {spaces.map((space) => {
                  const expanded = expandedSpaceIds[space.id];
                  const mapName =
                    maps.find((map) => map.id === space.mapId)?.name ?? "—";
                  return (
                    <div
                      key={space.id}
                      className="overflow-hidden rounded-lg border border-border"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
                        onClick={() => toggleSpaceExpanded(space.id)}
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {space.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Cap. {space.minCapacity}–{space.capacity}
                        </span>
                      </button>
                      {expanded && (
                        <div className="space-y-3 border-t border-border px-3 py-3">
                          <p className="text-sm text-muted-foreground">
                            {space.floor || "Sin piso"} · Mapa: {mapName}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={space.geometry ? "default" : "outline"}>
                              {space.geometry ? "Delimitado" : "Sin geometría"}
                            </Badge>
                            {!space.active && (
                              <Badge variant="secondary">Inactivo</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openEditSpace(space)}
                            >
                              <Pencil className="mr-1 h-4 w-4" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => setDeleteSpaceId(space.id)}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
          )}
        </Card>
      </div>

      <Dialog open={createSpaceOpen} onOpenChange={setCreateSpaceOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo espacio</DialogTitle>
            <DialogDescription>
              Crea el espacio y delímitalo después en el editor del mapa.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSpace} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spaceName">Nombre</Label>
              <Input
                id="spaceName"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="spaceFloor">Piso / zona</Label>
                <Input
                  id="spaceFloor"
                  value={spaceFloor}
                  onChange={(e) => setSpaceFloor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spaceCapacity">Capacidad máxima</Label>
                <Input
                  id="spaceCapacity"
                  type="number"
                  min={0}
                  value={spaceCapacity}
                  onChange={(e) => setSpaceCapacity(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="spaceMinCapacity">Capacidad mínima</Label>
                <Input
                  id="spaceMinCapacity"
                  type="number"
                  min={1}
                  value={spaceMinCapacity}
                  onChange={(e) => setSpaceMinCapacity(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="spaceMapId">Mapa asociado</Label>
              <Select
                id="spaceMapId"
                value={spaceMapId}
                onChange={(e) => setSpaceMapId(e.target.value)}
                required
              >
                {maps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setCreateSpaceOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                Crear
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editSpace)} onOpenChange={(open) => !open && setEditSpace(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar espacio</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateSpace} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editSpaceName">Nombre</Label>
              <Input
                id="editSpaceName"
                value={editSpaceName}
                onChange={(e) => setEditSpaceName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editSpaceFloor">Piso / zona</Label>
                <Input
                  id="editSpaceFloor"
                  value={editSpaceFloor}
                  onChange={(e) => setEditSpaceFloor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editSpaceCapacity">Capacidad máxima</Label>
                <Input
                  id="editSpaceCapacity"
                  type="number"
                  min={0}
                  value={editSpaceCapacity}
                  onChange={(e) => setEditSpaceCapacity(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="editSpaceMinCapacity">Capacidad mínima</Label>
                <Input
                  id="editSpaceMinCapacity"
                  type="number"
                  min={1}
                  value={editSpaceMinCapacity}
                  onChange={(e) => setEditSpaceMinCapacity(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editSpaceMapId">Mapa asociado</Label>
              <Select
                id="editSpaceMapId"
                value={editSpaceMapId}
                onChange={(e) => setEditSpaceMapId(e.target.value)}
              >
                {maps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editSpaceActive}
                onChange={(e) => setEditSpaceActive(e.target.checked)}
                className="rounded border-border"
              />
              Espacio activo
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setEditSpace(null)}
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
        open={Boolean(deleteSpaceId)}
        onOpenChange={(open) => !open && setDeleteSpaceId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar espacio</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. ¿Eliminar el espacio seleccionado?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteSpaceId(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              disabled={loading}
              onClick={confirmDeleteSpace}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
