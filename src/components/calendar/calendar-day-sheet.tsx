"use client";

import * as React from "react";
import Link from "next/link";
import type { Area } from "@/types/area";
import type { FloorMap, Space } from "@/types/space";
import type { ReservationDetail } from "@/types/reservation";
import {
  areaCardStyle,
  getAreaColor,
  getAreaHex,
  hexToRgba,
  MAP_AVAILABLE_FILL,
  MAP_AVAILABLE_STROKE,
} from "@/lib/area-colors";
import {
  getReservationAreaColor,
  isOwnAreaReservation,
  reservationStatusLabel,
} from "@/lib/calendar-utils";
import { formatDateDisplay, formatDateISO, isSameDay } from "@/lib/date-utils";
import { SpaceMapViewer } from "@/components/map-date/space-map-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface CalendarDaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  reservations: ReservationDetail[];
  maps: FloorMap[];
  spaces: Space[];
  areas: Area[];
  viewerAreaId: string | null;
  canReserve: boolean;
  initialMapId?: string;
  initialSpaceId?: string;
}

function reservationsOnDate(reservations: ReservationDetail[], date: Date) {
  return reservations
    .filter((reservation) => {
      if (reservation.status === "CANCELLED") return false;
      return isSameDay(new Date(reservation.startAt), date);
    })
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
}

function findReservationForSpace(
  dayEvents: ReservationDetail[],
  spaceId: string,
) {
  return (
    dayEvents.find((reservation) => reservation.spaceIds.includes(spaceId)) ??
    null
  );
}

export function CalendarDaySheet({
  open,
  onOpenChange,
  date,
  reservations,
  maps,
  spaces,
  areas,
  viewerAreaId,
  canReserve,
  initialMapId,
  initialSpaceId,
}: CalendarDaySheetProps) {
  const [mapId, setMapId] = React.useState(
    initialMapId ?? maps[0]?.id ?? "",
  );
  const [selectedSpaceId, setSelectedSpaceId] = React.useState<string | null>(
    initialSpaceId ?? null,
  );
  const [showAreaLegend, setShowAreaLegend] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setShowAreaLegend(false);
    if (initialMapId && maps.some((map) => map.id === initialMapId)) {
      setMapId(initialMapId);
    }
    if (initialSpaceId) {
      setSelectedSpaceId(initialSpaceId);
    } else {
      setSelectedSpaceId(null);
    }
  }, [open, date, initialMapId, initialSpaceId, maps]);

  const dayEvents = React.useMemo(
    () => (date ? reservationsOnDate(reservations, date) : []),
    [date, reservations],
  );

  const areasOnDay = React.useMemo(() => {
    const ids = new Set<string>();
    for (const event of dayEvents) {
      if (event.areaId) ids.add(event.areaId);
    }
    return areas.filter((area) => ids.has(area.id));
  }, [areas, dayEvents]);

  const occupancyBySpace = React.useMemo(() => {
    const map = new Map<string, ReservationDetail>();
    for (const event of dayEvents) {
      for (const spaceId of event.spaceIds) {
        if (!map.has(spaceId)) map.set(spaceId, event);
      }
    }
    return map;
  }, [dayEvents]);

  const currentMap = maps.find((item) => item.id === mapId) ?? maps[0];
  const mapSpaces = spaces.filter(
    (space) => space.mapId === mapId && space.active,
  );

  const spaceStatuses = React.useMemo(() => {
    const statuses: Record<string, "available" | "occupied"> = {};
    for (const space of mapSpaces) {
      statuses[space.id] = occupancyBySpace.has(space.id)
        ? "occupied"
        : "available";
    }
    return statuses;
  }, [mapSpaces, occupancyBySpace]);

  const viewerArea = areas.find((area) => area.id === viewerAreaId) ?? null;
  const viewerHex = getAreaHex(viewerArea);

  const selectedReservation = selectedSpaceId
    ? findReservationForSpace(dayEvents, selectedSpaceId)
    : null;

  const selectionAction = (() => {
    if (!selectedSpaceId || !date) return null;
    const reservation = selectedReservation;
    if (!reservation) {
      return canReserve ? "reserve" : null;
    }
    if (!isOwnAreaReservation(reservation, viewerAreaId)) return null;
    return "edit";
  })();

  if (!date) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-4 sm:px-6"
      >
        <SheetHeader className="text-left">
          <SheetTitle>{formatDateDisplay(date)}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {maps.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="daySheetMap">Mapa</Label>
              <Select
                id="daySheetMap"
                value={mapId}
                onChange={(event) => {
                  setMapId(event.target.value);
                  setSelectedSpaceId(null);
                }}
              >
                {maps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {currentMap ? (
            <SpaceMapViewer
              map={currentMap}
              spaces={mapSpaces}
              spaceStatuses={spaceStatuses}
              selectedSpaceIds={selectedSpaceId ? [selectedSpaceId] : []}
              onSpaceToggle={(spaceId) => {
                setSelectedSpaceId((current) =>
                  current === spaceId ? null : spaceId,
                );
              }}
              compact
              showDefaultLegend={false}
              headerExtra={
                <Button
                  type="button"
                  size="sm"
                  variant={showAreaLegend ? "default" : "outline"}
                  className="h-8 w-full text-xs"
                  disabled={areasOnDay.length === 0}
                  onClick={() => setShowAreaLegend((value) => !value)}
                >
                  {showAreaLegend ? "Ocultar leyenda de áreas" : "Ver leyenda de áreas"}
                </Button>
              }
              getSpacePaintStyle={(spaceId, availability, isSelected) => {
                const reservation = occupancyBySpace.get(spaceId);
                if (isSelected) {
                  const highlightHex = reservation
                    ? getAreaHex(
                        areas.find((a) => a.id === reservation.areaId) ?? null,
                      )
                    : viewerHex;
                  return {
                    fill: hexToRgba(highlightHex, 0.78),
                    stroke: highlightHex,
                    listening: true,
                  };
                }
                if (reservation) {
                  const hex = getAreaHex(
                    areas.find((a) => a.id === reservation.areaId) ?? null,
                  );
                  const own = isOwnAreaReservation(reservation, viewerAreaId);
                  return {
                    fill: hexToRgba(hex, 0.55),
                    stroke: hex,
                    listening: own,
                  };
                }
                return {
                  fill: MAP_AVAILABLE_FILL,
                  stroke: MAP_AVAILABLE_STROKE,
                  listening: true,
                };
              }}
            />
          ) : null}

          {showAreaLegend && areasOnDay.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {areasOnDay.map((area) => {
                const color = getAreaColor(area);
                return (
                  <span
                    key={area.id}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs"
                    style={areaCardStyle(color)}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color.hex }}
                    />
                    {area.name}
                  </span>
                );
              })}
            </div>
          )}

          {selectionAction === "reserve" && (
            <Button asChild className="w-full">
              <Link
                href={(() => {
                  const params = new URLSearchParams({
                    date: formatDateISO(date),
                  });
                  if (mapId) params.set("mapId", mapId);
                  if (selectedSpaceId) params.set("spaceId", selectedSpaceId);
                  return `/reserva?${params.toString()}`;
                })()}
                onClick={() => onOpenChange(false)}
              >
                Reservar
              </Link>
            </Button>
          )}

          {selectionAction === "edit" && selectedReservation && (
            <Button asChild className="w-full" variant="secondary">
              <Link
                href={`/reservas/${selectedReservation.id}/editar`}
                onClick={() => onOpenChange(false)}
              >
                Editar reserva
              </Link>
            </Button>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Eventos del día</h3>
            {dayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay reservas para este día.
              </p>
            ) : (
              dayEvents.map((reservation) => {
                const color = getReservationAreaColor(reservation, areas);
                const statusLabel = reservationStatusLabel(reservation);
                return (
                  <article
                    key={reservation.id}
                    className={cn("rounded-lg border p-3")}
                    style={areaCardStyle(color)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{reservation.eventName}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(reservation.startAt).toLocaleTimeString(
                            "es-MX",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                          {" – "}
                          {new Date(reservation.endAt).toLocaleTimeString(
                            "es-MX",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </p>
                      </div>
                      {statusLabel && (
                        <Badge variant="outline">{statusLabel}</Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm">
                      {reservation.spaceNames.join(", ")}
                    </p>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
