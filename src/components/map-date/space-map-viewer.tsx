"use client";

import * as React from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Loader2 } from "lucide-react";
import { Stage, Layer, Rect, Line, Image as KonvaImage, Text } from "react-konva";
import type { FloorMap, Space } from "@/types/space";
import type { SpaceAvailabilityStatus } from "@/types/reservation";
import { loadImage } from "@/lib/load-image";

const STATUS_COLORS: Record<
  SpaceAvailabilityStatus | "selected",
  { fill: string; stroke: string }
> = {
  available: { fill: "rgba(34, 197, 94, 0.35)", stroke: "#16a34a" },
  occupied: { fill: "rgba(239, 68, 68, 0.45)", stroke: "#dc2626" },
  selected: { fill: "rgba(59, 130, 246, 0.45)", stroke: "#2563eb" },
};

interface SpaceMapViewerProps {
  map: FloorMap;
  spaces: Space[];
  spaceStatuses: Record<string, SpaceAvailabilityStatus>;
  selectedSpaceIds: string[];
  onSpaceToggle?: (spaceId: string) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export function SpaceMapViewer({
  map,
  spaces,
  spaceStatuses,
  selectedSpaceIds,
  onSpaceToggle,
  readOnly = false,
  compact = false,
}: SpaceMapViewerProps) {
  const stageRef = React.useRef<Konva.Stage>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [backgroundImage, setBackgroundImage] =
    React.useState<HTMLImageElement | null>(null);
  const [loadingBg, setLoadingBg] = React.useState(true);
  const [containerWidth, setContainerWidth] = React.useState<number | null>(null);

  const mapWidth = map.width;
  const mapHeight = map.height;
  const measuredWidth = containerWidth ?? 0;
  const displayScale =
    measuredWidth > 0
      ? Math.min(measuredWidth / mapWidth, compact ? 0.6 : 1)
      : 0;

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    function updateSize() {
      if (!node) return;
      setContainerWidth(node.clientWidth);
    }

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
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
          setBackgroundImage(await loadImage(rendered.dataUrl));
          return;
        }
        setBackgroundImage(await loadImage(map.backgroundUrl));
      } finally {
        setLoadingBg(false);
      }
    }
    loadBackground();
  }, [map.backgroundType, map.backgroundUrl]);

  function getSpaceVisualStatus(spaceId: string): keyof typeof STATUS_COLORS {
    if (selectedSpaceIds.includes(spaceId)) return "selected";
    return spaceStatuses[spaceId] ?? "available";
  }

  function handleSpaceClick(
    spaceId: string,
    status: SpaceAvailabilityStatus,
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) {
    event.cancelBubble = true;
    if (readOnly || status === "occupied" || !onSpaceToggle) return;
    onSpaceToggle(spaceId);
  }

  const drawableSpaces = spaces.filter((space) => space.geometry && space.active);

  return (
    <div
      ref={containerRef}
      className="max-w-full overflow-hidden rounded-xl border border-border bg-muted/20 p-2"
    >
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-green-500/40 ring-1 ring-green-600" />
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

      {loadingBg || displayScale === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : drawableSpaces.length === 0 ? (
        <div className="flex h-64 items-center justify-center px-4 text-center text-sm text-muted-foreground">
          Este mapa no tiene espacios delimitados. Configúralos en Administración → Espacios.
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

              {drawableSpaces.map((space) => {
                if (!space.geometry) return null;

                const visualStatus = getSpaceVisualStatus(space.id);
                const availability = spaceStatuses[space.id] ?? "available";
                const colors = STATUS_COLORS[visualStatus];
                const interactive = !readOnly && availability !== "occupied";

                if (space.geometry.type === "rect") {
                  const [x, y, w, h] = space.geometry.points;
                  return (
                    <React.Fragment key={space.id}>
                      <Rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={2}
                        onClick={(event) =>
                          handleSpaceClick(space.id, availability, event)
                        }
                        onTap={(event) =>
                          handleSpaceClick(space.id, availability, event)
                        }
                        listening={interactive}
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
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={2}
                      onClick={(event) =>
                        handleSpaceClick(space.id, availability, event)
                      }
                      onTap={(event) =>
                        handleSpaceClick(space.id, availability, event)
                      }
                      listening={interactive}
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
        </div>
      )}
    </div>
  );
}
