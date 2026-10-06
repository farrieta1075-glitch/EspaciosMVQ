"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  ArrowLeft,
  Loader2,
  MousePointer2,
  Pentagon,
  Save,
  Square,
  Trash2,
} from "lucide-react";
import { Stage, Layer, Rect, Line, Image as KonvaImage, Text } from "react-konva";
import type { FloorMap, Space, SpaceGeometry } from "@/types/space";
import { loadImage } from "@/lib/load-image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SPACE_COLORS = [
  "#8B7355",
  "#A0522D",
  "#6B8E23",
  "#4682B4",
  "#9370DB",
  "#CD853F",
];

type DrawTool = "select" | "rect" | "polygon";

interface SpaceMapEditorProps {
  map: FloorMap;
  initialSpaces: Space[];
}

function getSpaceColor(index: number) {
  return SPACE_COLORS[index % SPACE_COLORS.length];
}

export function SpaceMapEditor({ map, initialSpaces }: SpaceMapEditorProps) {
  const router = useRouter();
  const stageRef = React.useRef<Konva.Stage>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [spaces, setSpaces] = React.useState(initialSpaces);
  const [selectedSpaceId, setSelectedSpaceId] = React.useState(
    initialSpaces[0]?.id ?? "",
  );
  const [tool, setTool] = React.useState<DrawTool>("rect");
  const [backgroundImage, setBackgroundImage] =
    React.useState<HTMLImageElement | null>(null);
  const [containerWidth, setContainerWidth] = React.useState(900);
  const [loadingBg, setLoadingBg] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const [draftRect, setDraftRect] = React.useState<number[] | null>(null);
  const [draftPolygon, setDraftPolygon] = React.useState<number[]>([]);
  const isDrawingRectRef = React.useRef(false);
  const rectStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const mapWidth = map.width;
  const mapHeight = map.height;
  const displayScale = Math.min(containerWidth / mapWidth, 1);

  React.useEffect(() => {
    function updateSize() {
      setContainerWidth(containerRef.current?.clientWidth ?? mapWidth);
    }

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [mapWidth]);

  React.useEffect(() => {
    async function loadBackground() {
      setLoadingBg(true);
      try {
        if (map.backgroundType === "blank" || !map.backgroundUrl) {
          setBackgroundImage(null);
          return;
        }

        if (map.backgroundType === "pdf") {
          const { renderPdfFirstPage } = await import("@/lib/pdf-render");
          const rendered = await renderPdfFirstPage(map.backgroundUrl);
          const img = await loadImage(rendered.dataUrl);
          setBackgroundImage(img);
          return;
        }

        const img = await loadImage(map.backgroundUrl);
        setBackgroundImage(img);
      } catch {
        setMessage("No se pudo cargar el fondo del mapa.");
      } finally {
        setLoadingBg(false);
      }
    }

    loadBackground();
  }, [map.backgroundType, map.backgroundUrl]);

  function getPointerPosition(): { x: number; y: number } | null {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return null;
    return { x: pos.x, y: pos.y };
  }

  function assignGeometry(spaceId: string, geometry: SpaceGeometry) {
    setSpaces((current) =>
      current.map((space, index) =>
        space.id === spaceId
          ? {
              ...space,
              geometry: {
                ...geometry,
                color: geometry.color ?? getSpaceColor(index),
              },
            }
          : space,
      ),
    );
    setMessage(`Área asignada a "${spaces.find((s) => s.id === spaceId)?.name ?? "espacio"}".`);
  }

  function handlePointerDown(event: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (tool === "select" || !selectedSpaceId) return;

    event.evt.preventDefault();

    const pos = getPointerPosition();
    if (!pos) return;

    if (tool === "rect") {
      isDrawingRectRef.current = true;
      rectStartRef.current = pos;
      setDraftRect([pos.x, pos.y, 0, 0]);
    }
  }

  function handlePointerMove(event: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (tool !== "rect" || !isDrawingRectRef.current || !rectStartRef.current) {
      return;
    }

    event.evt.preventDefault();
    const pos = getPointerPosition();
    if (!pos) return;

    const start = rectStartRef.current;
    setDraftRect([
      start.x,
      start.y,
      pos.x - start.x,
      pos.y - start.y,
    ]);
  }

  function finishRect() {
    if (
      tool !== "rect" ||
      !isDrawingRectRef.current ||
      !rectStartRef.current ||
      !selectedSpaceId
    ) {
      return;
    }

    const pos = getPointerPosition();
    const start = rectStartRef.current;
    if (!pos) {
      isDrawingRectRef.current = false;
      rectStartRef.current = null;
      setDraftRect(null);
      return;
    }

    const width = pos.x - start.x;
    const height = pos.y - start.y;
    const normalized = [
      width < 0 ? pos.x : start.x,
      height < 0 ? pos.y : start.y,
      Math.abs(width),
      Math.abs(height),
    ];

    if (normalized[2] > 4 && normalized[3] > 4) {
      assignGeometry(selectedSpaceId, { type: "rect", points: normalized });
    }

    isDrawingRectRef.current = false;
    rectStartRef.current = null;
    setDraftRect(null);
  }

  function handlePointerUp(event: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (tool !== "rect") return;
    event.evt.preventDefault();
    finishRect();
  }

  function handleLayerClick(event: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (tool !== "polygon" || !selectedSpaceId) return;

    // Evitar que el click de cierre del rectángulo dispare polígono
    if (isDrawingRectRef.current) return;

    const pos = getPointerPosition();
    if (!pos) return;

    // Clic sobre el stage/layer, no sobre texto u otra forma interactiva
    const targetClass = event.target.getClassName();
    if (!["Stage", "Layer", "Rect", "Image"].includes(targetClass)) return;

    setDraftPolygon((current) => [...current, pos.x, pos.y]);
  }

  function handleLayerDblClick(event: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (tool !== "polygon" || !selectedSpaceId || draftPolygon.length < 6) return;

    event.cancelBubble = true;
    assignGeometry(selectedSpaceId, {
      type: "polygon",
      points: draftPolygon,
    });
    setDraftPolygon([]);
  }

  function clearSelectedGeometry() {
    if (!selectedSpaceId) return;
    setSpaces((current) =>
      current.map((space) =>
        space.id === selectedSpaceId ? { ...space, geometry: null } : space,
      ),
    );
    setMessage("Geometría eliminada del espacio seleccionado.");
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const results = await Promise.all(
        spaces.map((space) =>
          fetch(`/api/admin/espacios/${space.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ geometry: space.geometry }),
          }),
        ),
      );

      if (results.some((res) => !res.ok)) {
        throw new Error("Algunos espacios no se guardaron");
      }

      setMessage("Geometrías guardadas correctamente.");
      router.refresh();
    } catch {
      setMessage("Error al guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const canDraw = Boolean(selectedSpaceId) && spaces.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/admin/espacios">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Volver
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{map.name}</h1>
          <p className="text-sm text-muted-foreground">
            Delimita espacios con rectángulos o polígonos sobre el plano.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar mapa
        </Button>
      </div>

      {spaces.length === 0 && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Primero crea al menos un espacio asociado a este mapa en{" "}
          <Link href="/admin/espacios" className="underline">
            Administración de espacios
          </Link>
          .
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 space-y-4 rounded-xl border border-border bg-card p-4 lg:w-72">
          <div className="space-y-2">
            <Label htmlFor="spaceSelect">Espacio a delimitar</Label>
            <Select
              id="spaceSelect"
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(e.target.value)}
              disabled={spaces.length === 0}
            >
              {spaces.length === 0 ? (
                <option value="">Sin espacios</option>
              ) : (
                spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))
              )}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Herramienta</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["select", MousePointer2, "Seleccionar"],
                  ["rect", Square, "Rectángulo"],
                  ["polygon", Pentagon, "Polígono"],
                ] as const
              ).map(([value, Icon, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={tool === value ? "default" : "outline"}
                  className="flex h-auto flex-col gap-1 px-2 py-3 text-[10px]"
                  disabled={!canDraw && value !== "select"}
                  onClick={() => {
                    setTool(value);
                    setDraftPolygon([]);
                    setDraftRect(null);
                    isDrawingRectRef.current = false;
                    rectStartRef.current = null;
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {tool === "rect" && canDraw && (
            <p className="text-xs text-muted-foreground">
              Mantén presionado y arrastra sobre el mapa para dibujar un rectángulo.
            </p>
          )}

          {tool === "polygon" && canDraw && (
            <p className="text-xs text-muted-foreground">
              Clic para añadir vértices. Doble clic para cerrar el polígono.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={clearSelectedGeometry}
            disabled={!selectedSpaceId}
          >
            <Trash2 className="h-4 w-4" />
            Borrar geometría
          </Button>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Espacios en este mapa
            </p>
            {spaces.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay espacios en este mapa.</p>
            ) : (
              spaces.map((space, index) => (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => setSelectedSpaceId(space.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    selectedSpaceId === space.id
                      ? "bg-accent"
                      : "hover:bg-muted/60",
                  )}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{
                      backgroundColor:
                        space.geometry?.color ?? getSpaceColor(index),
                    }}
                  />
                  <span className="truncate">{space.name}</span>
                  {space.geometry && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      ✓
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        <div
          ref={containerRef}
          className="min-w-0 flex-1 overflow-auto rounded-xl border border-border bg-muted/30 p-2"
        >
          {loadingBg ? (
            <div className="flex h-[400px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div
              style={{
                width: mapWidth * displayScale,
                height: mapHeight * displayScale,
              }}
              className="mx-auto"
            >
              <Stage
                ref={stageRef}
                width={mapWidth}
                height={mapHeight}
                scaleX={displayScale}
                scaleY={displayScale}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                onClick={handleLayerClick}
                onDblClick={handleLayerDblClick}
                className="touch-none bg-white shadow-sm dark:bg-zinc-900"
                style={{
                  width: mapWidth * displayScale,
                  height: mapHeight * displayScale,
                }}
              >
                <Layer>
                  {backgroundImage ? (
                    <KonvaImage
                      image={backgroundImage}
                      width={mapWidth}
                      height={mapHeight}
                      listening={false}
                    />
                  ) : (
                    <Rect
                      width={mapWidth}
                      height={mapHeight}
                      fill="#faf8f5"
                      stroke="#d6d3d1"
                      strokeWidth={1}
                      listening={false}
                    />
                  )}

                  {/* Capa de captura de eventos para dibujar */}
                  <Rect
                    width={mapWidth}
                    height={mapHeight}
                    fill="rgba(0,0,0,0.001)"
                    listening={tool !== "select"}
                  />

                  {spaces.map((space, index) => {
                    if (!space.geometry) return null;
                    const color = space.geometry.color ?? getSpaceColor(index);
                    const opacity = selectedSpaceId === space.id ? 0.45 : 0.3;

                    if (space.geometry.type === "rect") {
                      const [x, y, w, h] = space.geometry.points;
                      return (
                        <React.Fragment key={space.id}>
                          <Rect
                            x={x}
                            y={y}
                            width={w}
                            height={h}
                            fill={color}
                            opacity={opacity}
                            stroke={color}
                            strokeWidth={2}
                            listening={false}
                          />
                          <Text
                            x={x + 8}
                            y={y + 8}
                            text={space.name}
                            fontSize={14}
                            fill="#1c1917"
                            listening={false}
                          />
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={space.id}>
                        <Line
                          points={space.geometry.points}
                          closed
                          fill={color}
                          opacity={opacity}
                          stroke={color}
                          strokeWidth={2}
                          listening={false}
                        />
                        <Text
                          x={space.geometry.points[0] + 8}
                          y={space.geometry.points[1] + 8}
                          text={space.name}
                          fontSize={14}
                          fill="#1c1917"
                          listening={false}
                        />
                      </React.Fragment>
                    );
                  })}

                  {draftRect && (
                    <Rect
                      x={draftRect[0]}
                      y={draftRect[1]}
                      width={draftRect[2]}
                      height={draftRect[3]}
                      fill="rgba(107, 90, 77, 0.15)"
                      stroke="#6b5a4d"
                      dash={[6, 4]}
                      strokeWidth={2}
                      listening={false}
                    />
                  )}

                  {draftPolygon.length >= 2 && (
                    <Line
                      points={draftPolygon}
                      stroke="#6b5a4d"
                      strokeWidth={2}
                      dash={[6, 4]}
                      listening={false}
                    />
                  )}
                </Layer>
              </Stage>
            </div>
          )}
        </div>
      </div>

      {message && (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
