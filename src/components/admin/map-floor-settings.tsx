"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import type { FloorMap, MapFloorId } from "@/types/space";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface MapFloorSettingsProps {
  map: FloorMap;
  onUpdated: (map: FloorMap) => void;
}

export function MapFloorSettings({ map, onUpdated }: MapFloorSettingsProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [primaryFloor, setPrimaryFloor] = React.useState<MapFloorId>(
    map.primaryFloor ?? "1",
  );
  const [floor1Label, setFloor1Label] = React.useState(
    map.floor1Label ?? "Planta baja",
  );
  const [floor2Label, setFloor2Label] = React.useState(
    map.floor2Label ?? "Piso 2",
  );
  const [floor2File, setFloor2File] = React.useState<File | null>(null);

  async function saveMeta() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/admin/mapas/${map.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryFloor,
        floor1Label,
        floor2Label,
      }),
    });
    if (!response.ok) {
      setError("No se pudo guardar la configuración de plantas.");
      setLoading(false);
      return;
    }
    onUpdated(await response.json());
    setLoading(false);
  }

  async function uploadFloor2() {
    if (!floor2File) return;
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", floor2File);
    formData.append("mapId", map.id);
    formData.append(
      "backgroundType",
      floor2File.type === "application/pdf" ? "pdf" : "image",
    );
    formData.append("floorTarget", "2");
    const response = await fetch("/api/admin/mapas/upload", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      setError("No se pudo subir el plano del segundo piso.");
      setLoading(false);
      return;
    }
    onUpdated(await response.json());
    setFloor2File(null);
    setLoading(false);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-sm font-medium">Plantas del mapa</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="floor1Label">Nombre planta 1</Label>
          <Input
            id="floor1Label"
            value={floor1Label}
            onChange={(e) => setFloor1Label(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="floor2Label">Nombre planta 2</Label>
          <Input
            id="floor2Label"
            value={floor2Label}
            onChange={(e) => setFloor2Label(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="primaryFloor">Planta que se muestra primero</Label>
        <Select
          id="primaryFloor"
          value={primaryFloor}
          onChange={(e) => setPrimaryFloor(e.target.value === "2" ? "2" : "1")}
        >
          <option value="1">{floor1Label || "Planta baja"}</option>
          <option value="2">{floor2Label || "Piso 2"}</option>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="floor2File">Plano segundo piso (imagen o PDF)</Label>
        <Input
          id="floor2File"
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFloor2File(e.target.files?.[0] ?? null)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={loading} onClick={() => void saveMeta()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar nombres y orden"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading || !floor2File}
          onClick={() => void uploadFloor2()}
        >
          Subir plano piso 2
        </Button>
      </div>
    </div>
  );
}
