"use client";

import * as React from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Loader2 } from "lucide-react";
import { Stage, Layer, Rect, Line, Text } from "react-konva";
import { MapFloorSwitcher } from "@/components/map-date/map-floor-switcher";
import {
  getMapFloorDisplayOrder,
  getMapFloorLayer,
  spaceBelongsToFloor,
  normalizeMapFloorId,
} from "@/lib/map-floors";
import type { FloorMap, MapFloorId, Space } from "@/types/space";
import type { SpaceAvailabilityStatus } from "@/types/reservation";
import {
  MAP_AVAILABLE_HEX,
  MAP_AVAILABLE_STROKE,
  hexToRgba,
} from "@/lib/area-colors";
import { getCachedMapBackground } from "@/lib/map-background-cache";

const STATUS_COLORS: Record<
  SpaceAvailabilityStatus | "selected",
  { fill: string; stroke: string }
> = {
  available: { fill: "rgba(34, 197, 94, 0.35)", stroke: "#16a34a" },
  occupied: { fill: "rgba(239, 68, 68, 0.45)", stroke: "#dc2626" },
  selected: { fill: "rgba(59, 130, 246, 0.45)", stroke: "#2563eb" },
};

export interface SpacePaintStyle {
  fill: string;
  stroke: string;
  listening: boolean;
}

interface SpaceMapViewerProps {
  map: FloorMap;
  spaces: Space[];
  spaceStatuses: Record<string, SpaceAvailabilityStatus>;
  selectedSpaceIds: string[];
  onSpaceToggle?: (spaceId: string) => void;
  readOnly?: boolean;
  compact?: boolean;
  fitContainerWidth?: boolean;
  showDefaultLegend?: boolean;
  headerExtra?: React.ReactNode;
  getSpacePaintStyle?: (
    spaceId: string,
    availability: SpaceAvailabilityStatus,
    isSelected: boolean,
  ) => SpacePaintStyle;
}

export function SpaceMapViewer({
  map,
  spaces,
  spaceStatuses,
  selectedSpaceIds,
  onSpaceToggle,
  readOnly = false,
  compact = false,
  fitContainerWidth = false,
  showDefaultLegend = true,
  headerExtra,
  getSpacePaintStyle,
}: SpaceMapViewerProps) {
  const stageRef = React.useRef<Konva.Stage>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stageBoxRef = React.useRef<HTMLDivElement>(null);
  /** Evita doble toggle en móvil (Konva dispara onTap y onClick por un mismo toque). */
  const lastSpaceToggleRef = React.useRef<{ spaceId: string; at: number } | null>(
    null,
  );
  const touchHitSlop = compact ? 28 : 20;
  const [backgroundImage, setBackgroundImage] =
    React.useState<HTMLImageElement | null>(null);
  const [loadingBg, setLoadingBg] = React.useState(true);
  const [containerWidth, setContainerWidth] = React.useState<number | null>(null);

  const hasFloorTwoSpaces = spaces.some(
    (space) => space.active && normalizeMapFloorId(space.floor) === "2",
  );
  const floorOrder = React.useMemo(() => {
    const order = getMapFloorDisplayOrder(map);
    if (hasFloorTwoSpaces && !order.includes("2")) return [...order, "2"];
    return order;
  }, [map, hasFloorTwoSpaces]);
  const [activeFloor, setActiveFloor] = React.useState<MapFloorId>(
    floorOrder[0] ?? "1",
  );
  React.useEffect(() => {
    setActiveFloor((current) =>
      floorOrder.includes(current) ? current : (floorOrder[0] ?? "1"),
    );
  }, [map.id, floorOrder]);

  const layer = React.useMemo(
    () => getMapFloorLayer(map, activeFloor),
    [map, activeFloor],
  );
  const mapWidth = layer.width;
  const mapHeight = layer.height;
  const floorLabels = React.useMemo(
    () => ({
      "1": getMapFloorLayer(map, "1").label,
      "2": getMapFloorLayer(map, "2").label,
    }),
    [map],
  );
  const measuredWidth =
    containerWidth && containerWidth > 0 ? containerWidth : 0;
  const displayScale =
    mapWidth > 0 && measuredWidth > 0
      ? Math.min(measuredWidth / mapWidth, 1)
      : 0;
  const cssWidth = Math.max(1, Math.round(mapWidth * displayScale));
  const cssHeight = Math.max(1, Math.round(mapHeight * displayScale));
  const showFloorSwitcher = floorOrder.length > 1;

  React.useEffect(() => {
    const node = stageBoxRef.current ?? containerRef.current;
    if (!node) return;

    function updateSize() {
      if (!node) return;
      setContainerWidth(Math.max(0, node.clientWidth));
    }

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [mapWidth, compact, fitContainerWidth, headerExtra, showDefaultLegend, showFloorSwitcher]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadBackground() {
      setLoadingBg(true);
      try {
        const image = await getCachedMapBackground({
          backgroundType: layer.backgroundType,
          backgroundUrl: layer.backgroundUrl,
        });
        if (!cancelled) setBackgroundImage(image);
      } finally {
        if (!cancelled) setLoadingBg(false);
      }
    }
    void loadBackground();
    return () => {
      cancelled = true;
    };
  }, [layer.backgroundType, layer.backgroundUrl, activeFloor, map.id]);

  function resolvePaintStyle(
    spaceId: string,
    availability: SpaceAvailabilityStatus,
    isSelected: boolean,
  ): SpacePaintStyle {
    if (getSpacePaintStyle) {
      return getSpacePaintStyle(spaceId, availability, isSelected);
    }

    const visualStatus = isSelected
      ? "selected"
      : availability === "occupied"
        ? "occupied"
        : "available";
    const colors = STATUS_COLORS[visualStatus];
    const interactive =
      !readOnly && (availability !== "occupied" || isSelected);

    return {
      fill: colors.fill,
      stroke: colors.stroke,
      listening: interactive && Boolean(onSpaceToggle),
    };
  }

  function handleSpacePointer(
    spaceId: string,
    paint: SpacePaintStyle,
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) {
    event.cancelBubble = true;
    if (!paint.listening || !onSpaceToggle) return;

    const now = Date.now();
    const last = lastSpaceToggleRef.current;
    if (last && last.spaceId === spaceId && now - last.at < 450) {
      return;
    }
    lastSpaceToggleRef.current = { spaceId, at: now };
    onSpaceToggle(spaceId);
  }

  const drawableSpaces = spaces.filter(
    (space) =>
      space.geometry &&
      space.active &&
      spaceBelongsToFloor(space.floor, activeFloor),
  );

  return (
    <div
      ref={containerRef}
      className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-muted/20 p-1 sm:p-2"
    >
      {showFloorSwitcher && (
        <MapFloorSwitcher
          floors={floorOrder}
          labels={floorLabels}
          activeFloor={activeFloor}
          onChange={setActiveFloor}
          className="mb-2"
        />
      )}
      {(showDefaultLegend || headerExtra) && (
        <div className="mb-2 space-y-2">
          {showDefaultLegend && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-sm ring-1"
                  style={{
                    backgroundColor: hexToRgba(MAP_AVAILABLE_HEX, 0.65),
                    borderColor: MAP_AVAILABLE_STROKE,
                  }}
                />
                Disponible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-red-500/40 ring-1 ring-red-600" />
                Ocupado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-blue-500/40 ring-1 ring-blue-600" />
                Seleccionado
              </span>
            </div>
          )}
          {headerExtra}
        </div>
      )}

      <div ref={stageBoxRef} className="w-full min-w-0 max-w-full overflow-auto">
      {loadingBg || displayScale <= 0 ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div
          style={{ width: cssWidth, height: cssHeight }}
          className="relative mx-auto max-w-full"
        >
          {backgroundImage ? (
            // El editor pinta el PDF/imagen bien; en reserva el canvas de Konva
            // se recortaba. El <img> garantiza el plano completo detrás.
            <img
              src={backgroundImage.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-fill"
            />
          ) : null}
          <Stage
            ref={stageRef}
            width={mapWidth}
            height={mapHeight}
            scaleX={displayScale}
            scaleY={displayScale}
            pixelRatio={1}
            className="touch-manipulation bg-transparent shadow-sm"
            style={{
              width: cssWidth,
              height: cssHeight,
              maxWidth: "100%",
            }}
          >
            <Layer>
              {backgroundImage ? null : (
                <Rect
                  width={mapWidth}
                  height={mapHeight}
                  fill="#faf8f5"
                  stroke="#d6d3d1"
                  strokeWidth={1}
                  listening={false}
                />
              )}

              {drawableSpaces.map((space) => {
                if (!space.geometry) return null;

                const availability = spaceStatuses[space.id] ?? "available";
                const isSelected = selectedSpaceIds.includes(space.id);
                const paint = resolvePaintStyle(space.id, availability, isSelected);

                if (space.geometry.type === "rect") {
                  const [x, y, w, h] = space.geometry.points;
                  return (
                    <React.Fragment key={space.id}>
                      <Rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        fill={paint.fill}
                        stroke={paint.stroke}
                        strokeWidth={isSelected ? 3 : 2}
                        onTap={(event) =>
                          handleSpacePointer(space.id, paint, event)
                        }
                        hitStrokeWidth={touchHitSlop}
                        listening={paint.listening}
                      />
                      <Text
                        x={x + 8}
                        y={y + 8}
                        text={space.name}
                        fontSize={compact ? 11 : 13}
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
                      fill={paint.fill}
                      stroke={paint.stroke}
                      strokeWidth={isSelected ? 3 : 2}
                      onTap={(event) =>
                        handleSpacePointer(space.id, paint, event)
                      }
                      hitStrokeWidth={touchHitSlop}
                      listening={paint.listening}
                    />
                    <Text
                      x={space.geometry.points[0] + 8}
                      y={space.geometry.points[1] + 8}
                      text={space.name}
                      fontSize={compact ? 11 : 13}
                      fill="#1c1917"
                      listening={false}
                    />
                  </React.Fragment>
                );
              })}
            </Layer>
          </Stage>
          {drawableSpaces.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/55 px-4 text-center text-sm text-muted-foreground">
              {spaces.some((space) => space.geometry && space.active)
                ? `No hay espacios visibles en ${layer.label}. Cambia de planta o activa todos los espacios.`
                : "Este mapa no tiene espacios delimitados. Configúralos en Administración → Espacios."}
            </div>
          ) : null}
        </div>
      )}
      </div>
    </div>
  );
}
