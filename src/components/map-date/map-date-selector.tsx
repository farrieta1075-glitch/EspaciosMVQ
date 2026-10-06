"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import type { Area } from "@/types/area";
import type { FloorMap, Space } from "@/types/space";
import {
  getAreaHex,
  hexToRgba,
  MAP_AVAILABLE_FILL,
  MAP_AVAILABLE_STROKE,
} from "@/lib/area-colors";
import type {
  AvailabilityResponse,
  MapDateSelection,
  SpaceAvailabilityStatus,
} from "@/types/reservation";
import { DateNavigator } from "@/components/map-date/date-navigator";
import { ResourcePanel } from "@/components/map-date/resource-panel";
import { SpaceMapViewer } from "@/components/map-date/space-map-viewer";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDateISO } from "@/lib/date-utils";

export interface InitialMapSelection {
  date?: string;
  startTime?: string;
  endTime?: string;
  mapId?: string;
  selectedSpaceIds?: string[];
  selectedResources?: Record<string, number>;
}

interface MapDateSelectorProps {
  maps: FloorMap[];
  spaces: Space[];
  defaultMapId?: string;
  initialDate?: string;
  initialMapId?: string;
  initialSpaceId?: string;
  initialSelection?: InitialMapSelection;
  showResourcePanel?: boolean;
  showCalendarLink?: boolean;
  readOnly?: boolean;
  compact?: boolean;
  layout?: "default" | "reservation";
  areas?: Area[];
  highlightAreaId?: string | null;
  resourcesSheetOpen?: boolean;
  onResourcesSheetOpenChange?: (open: boolean) => void;
  /** Excluye esta reserva al calcular disponibilidad (edición). */
  excludeReservationId?: string;
  onSelectionChange?: (selection: MapDateSelection) => void;
}

export function MapDateSelector({
  maps,
  spaces,
  defaultMapId,
  initialDate,
  initialMapId,
  initialSpaceId,
  initialSelection,
  showResourcePanel = true,
  showCalendarLink = true,
  readOnly = false,
  compact = false,
  layout = "default",
  areas = [],
  highlightAreaId = null,
  resourcesSheetOpen,
  onResourcesSheetOpenChange,
  excludeReservationId,
  onSelectionChange,
}: MapDateSelectorProps) {
  const isReservationLayout = layout === "reservation";
  const [selectedDate, setSelectedDate] = React.useState(() => {
    const dateStr = initialSelection?.date ?? initialDate;
    if (dateStr) {
      const [y, m, d] = dateStr.split("-").map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const [startTime, setStartTime] = React.useState(
    initialSelection?.startTime ??
      (isReservationLayout ? "" : "09:00"),
  );
  const [endTime, setEndTime] = React.useState(
    initialSelection?.endTime ?? (isReservationLayout ? "" : "18:00"),
  );
  const [internalResourcesOpen, setInternalResourcesOpen] = React.useState(false);
  const resourcesOpen = resourcesSheetOpen ?? internalResourcesOpen;
  const setResourcesOpen = onResourcesSheetOpenChange ?? setInternalResourcesOpen;
  const [mapId, setMapId] = React.useState(() => {
    if (initialSelection?.mapId) return initialSelection.mapId;
    if (initialMapId) return initialMapId;
    if (initialSpaceId) {
      const space = spaces.find((item) => item.id === initialSpaceId);
      if (space?.mapId) return space.mapId;
    }
    return defaultMapId ?? maps[0]?.id ?? "";
  });
  const [selectedSpaceIds, setSelectedSpaceIds] = React.useState<string[]>(
    () => {
      if (initialSelection?.selectedSpaceIds?.length) {
        return initialSelection.selectedSpaceIds;
      }
      if (initialSpaceId) return [initialSpaceId];
      return [];
    },
  );
  const [selectedResources, setSelectedResources] = React.useState<
    Record<string, number>
  >(initialSelection?.selectedResources ?? {});
  const [availability, setAvailability] =
    React.useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = React.useState(false);

  const currentMap = maps.find((map) => map.id === mapId) ?? maps[0];
  const mapSpaces = spaces.filter(
    (space) => space.mapId === mapId && space.active,
  );

  const spaceStatuses = React.useMemo(() => {
    const statuses: Record<string, SpaceAvailabilityStatus> = {};
    for (const space of availability?.spaces ?? []) {
      statuses[space.id] = space.status;
    }
    return statuses;
  }, [availability?.spaces]);

  React.useEffect(() => {
    if (initialSelection?.mapId) return;
    if (!mapId && maps[0]?.id) setMapId(maps[0].id);
  }, [mapId, maps, initialSelection?.mapId]);

  const skipClearSpacesOnMapChange = React.useRef(true);
  React.useEffect(() => {
    if (initialSelection) return;
    if (skipClearSpacesOnMapChange.current) {
      skipClearSpacesOnMapChange.current = false;
      return;
    }
    setSelectedSpaceIds([]);
    setSelectedResources({});
  }, [mapId, initialSelection]);

  const spaceOccupantAreaIds = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const space of availability?.spaces ?? []) {
      if (space.areaId) map.set(space.id, space.areaId);
    }
    return map;
  }, [availability?.spaces]);

  const reservationPaintStyle = React.useCallback(
    (
      spaceId: string,
      availabilityStatus: SpaceAvailabilityStatus,
      isSelected: boolean,
    ) => {
      const highlightArea =
        areas.find((area) => area.id === highlightAreaId) ?? null;
      const viewerHex = getAreaHex(highlightArea);

      if (isSelected) {
        const occupantId = spaceOccupantAreaIds.get(spaceId);
        const highlightHex =
          availabilityStatus === "occupied" && occupantId
            ? getAreaHex(areas.find((area) => area.id === occupantId) ?? null)
            : viewerHex;
        return {
          fill: hexToRgba(highlightHex, 0.78),
          stroke: highlightHex,
          listening: true,
        };
      }

      if (availabilityStatus === "occupied") {
        const hex = getAreaHex(
          areas.find(
            (area) => area.id === spaceOccupantAreaIds.get(spaceId),
          ) ?? null,
        );
        return {
          fill: hexToRgba(hex, 0.55),
          stroke: hex,
          listening: false,
        };
      }

      return {
        fill: MAP_AVAILABLE_FILL,
        stroke: MAP_AVAILABLE_STROKE,
        listening: !readOnly,
      };
    },
    [areas, highlightAreaId, readOnly, spaceOccupantAreaIds],
  );

  React.useEffect(() => {
    if (!mapId) return;
    const timesValid =
      /^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime);
    if (!timesValid) {
      setAvailability({ spaces: [], resources: [] });
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchAvailability() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          date: formatDateISO(selectedDate),
          startTime,
          endTime,
          mapId,
        });

        if (selectedSpaceIds.length > 0) {
          params.set("selectedSpaceIds", selectedSpaceIds.join(","));
        }
        if (excludeReservationId) {
          params.set("excludeReservationId", excludeReservationId);
        }

        const response = await fetch(`/api/availability?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Error al consultar disponibilidad");
        setAvailability(await response.json());
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setAvailability({ spaces: [], resources: [] });
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAvailability();
    return () => controller.abort();
  }, [
    selectedDate,
    startTime,
    endTime,
    mapId,
    selectedSpaceIds,
    excludeReservationId,
  ]);

  React.useEffect(() => {
    if (!onSelectionChange || !mapId) return;

    onSelectionChange({
      date: formatDateISO(selectedDate),
      startTime,
      endTime,
      mapId,
      selectedSpaceIds,
      selectedResources: Object.entries(selectedResources)
        .filter(([, qty]) => qty > 0)
        .map(([resourceId, quantity]) => ({ resourceId, quantity })),
    });
  }, [
    selectedDate,
    startTime,
    endTime,
    mapId,
    selectedSpaceIds,
    selectedResources,
    onSelectionChange,
  ]);

  function handleSpaceToggle(spaceId: string) {
    setSelectedSpaceIds((current) =>
      current.includes(spaceId)
        ? current.filter((id) => id !== spaceId)
        : [...current, spaceId],
    );
  }

  function handleResourceQuantityChange(resourceId: string, quantity: number) {
    setSelectedResources((current) => ({
      ...current,
      [resourceId]: quantity,
    }));
  }

  const calendarHref = React.useMemo(() => {
    const params = new URLSearchParams({
      date: formatDateISO(selectedDate),
    });
    if (mapId) params.set("mapId", mapId);
    if (selectedSpaceIds[0]) params.set("spaceId", selectedSpaceIds[0]);
    return `/calendario?${params.toString()}`;
  }, [selectedDate, mapId, selectedSpaceIds]);

  if (maps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No hay mapas configurados. Crea uno en Administración → Espacios.
      </div>
    );
  }

  return (
    <div className={isReservationLayout ? "space-y-2" : "space-y-4"}>
      <DateNavigator
        date={selectedDate}
        startTime={startTime}
        endTime={endTime}
        onDateChange={setSelectedDate}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
        showCalendarLink={showCalendarLink && !isReservationLayout}
        variant={isReservationLayout ? "reservation" : "default"}
        calendarHref={isReservationLayout ? calendarHref : undefined}
      />

      {maps.length > 1 && (
        <div
          className={
            isReservationLayout ? "space-y-1" : "max-w-xs space-y-2"
          }
        >
          <Label htmlFor="mapSelect" className={isReservationLayout ? "text-xs" : undefined}>
            Mapa
          </Label>
          <Select
            id="mapSelect"
            value={mapId}
            onChange={(event) => setMapId(event.target.value)}
          >
            {maps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div
        className={
          compact || isReservationLayout
            ? "space-y-2"
            : "grid gap-4 xl:grid-cols-[minmax(260px,320px)_1fr]"
        }
      >
        {showResourcePanel && !compact && !isReservationLayout && (
          <ResourcePanel
            resources={availability?.resources ?? []}
            selectedResources={selectedResources}
            onQuantityChange={handleResourceQuantityChange}
            readOnly={readOnly}
            className="hidden xl:block"
          />
        )}

        <div className="relative w-full min-w-0 max-w-full space-y-2">
          {loading && (
            <div className="absolute right-2 top-2 z-10 flex items-center gap-2 rounded-md bg-background/90 px-2 py-1 text-xs shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Actualizando...
            </div>
          )}

          {currentMap && (
            <SpaceMapViewer
              map={currentMap}
              spaces={mapSpaces}
              spaceStatuses={spaceStatuses}
              selectedSpaceIds={selectedSpaceIds}
              onSpaceToggle={readOnly ? undefined : handleSpaceToggle}
              readOnly={readOnly}
              compact={compact || isReservationLayout}
              fitContainerWidth={isReservationLayout}
              showDefaultLegend={!isReservationLayout}
              getSpacePaintStyle={
                isReservationLayout ? reservationPaintStyle : undefined
              }
            />
          )}

          {!readOnly &&
            !isReservationLayout &&
            selectedSpaceIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedSpaceIds.length} espacio(s) seleccionado(s):{" "}
              {selectedSpaceIds
                .map((id) => mapSpaces.find((s) => s.id === id)?.name ?? id)
                .join(", ")}
            </p>
          )}
        </div>
      </div>

      {showResourcePanel && !compact && !isReservationLayout && (
        <ResourcePanel
          resources={availability?.resources ?? []}
          selectedResources={selectedResources}
          onQuantityChange={handleResourceQuantityChange}
          readOnly={readOnly}
          mobileAsSheet
        />
      )}

      {isReservationLayout && showResourcePanel && !readOnly && (
        <Sheet open={resourcesOpen} onOpenChange={setResourcesOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] overflow-y-auto px-4 pb-8 pt-4"
          >
            <SheetHeader className="text-left">
              <SheetTitle>Recursos</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <ResourcePanel
                inline
                resources={availability?.resources ?? []}
                selectedResources={selectedResources}
                onQuantityChange={handleResourceQuantityChange}
                readOnly={readOnly}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
