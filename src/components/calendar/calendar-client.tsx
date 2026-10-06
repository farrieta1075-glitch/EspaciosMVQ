"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  FilterX,
  LayoutGrid,
  Rows3,
} from "lucide-react";
import type { Area } from "@/types/area";
import type { FloorMap, Space } from "@/types/space";
import type { ReservationDetail } from "@/types/reservation";
import { getAreaColor } from "@/lib/area-colors";
import {
  getReservationAreaColor,
  reservationStatusLabel,
} from "@/lib/calendar-utils";
import { SpaceMapViewer } from "@/components/map-date/space-map-viewer";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  addMonths,
  addWeeks,
  formatDateDisplay,
  formatDateISO,
  formatMonthYear,
  formatWeekRange,
  isSameDay,
} from "@/lib/date-utils";
import { cn } from "@/lib/utils";

type CalendarViewMode = "week" | "month";

interface CalendarClientProps {
  reservations: ReservationDetail[];
  maps: FloorMap[];
  spaces: Space[];
  areas: Area[];
  isAdmin: boolean;
  canReserve: boolean;
  initialDate?: string;
}

function reservationMatchesSpaceFilter(
  reservation: ReservationDetail,
  spaceId: string | null,
) {
  if (!spaceId) return true;
  return reservation.spaceIds.includes(spaceId);
}

function reservationOnDate(reservation: ReservationDetail, date: Date) {
  const start = new Date(reservation.startAt);
  return isSameDay(start, date);
}

export function CalendarClient({
  reservations,
  maps,
  spaces,
  areas,
  isAdmin,
  canReserve,
  initialDate,
}: CalendarClientProps) {
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>("week");
  const [anchorDate, setAnchorDate] = React.useState(() => {
    if (initialDate) {
      const [y, m, d] = initialDate.split("-").map(Number);
      if (y && m && d) return new Date(y, m - 1, d, 12);
    }
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today;
  });
  const [selectedDate, setSelectedDate] = React.useState(anchorDate);
  const [filterSpaceId, setFilterSpaceId] = React.useState<string | null>(null);
  const [mapId, setMapId] = React.useState(maps[0]?.id ?? "");

  const currentMap = maps.find((map) => map.id === mapId) ?? maps[0];
  const mapSpaces = spaces.filter(
    (space) => space.mapId === mapId && space.active,
  );

  const areaNameById = React.useMemo(
    () => new Map(areas.map((area) => [area.id, area.name])),
    [areas],
  );

  const pendingCount = React.useMemo(
    () => reservations.filter((reservation) => reservation.needsApproval).length,
    [reservations],
  );

  const filteredReservations = React.useMemo(
    () =>
      reservations.filter((reservation) =>
        reservationMatchesSpaceFilter(reservation, filterSpaceId),
      ),
    [reservations, filterSpaceId],
  );

  const datesWithEvents = React.useMemo(() => {
    const set = new Set<string>();
    for (const reservation of filteredReservations) {
      set.add(formatDateISO(new Date(reservation.startAt)));
    }
    return set;
  }, [filteredReservations]);

  const selectedDayEvents = React.useMemo(
    () =>
      filteredReservations
        .filter((reservation) => reservationOnDate(reservation, selectedDate))
        .sort(
          (a, b) =>
            new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        ),
    [filteredReservations, selectedDate],
  );

  function navigate(direction: -1 | 1) {
    setAnchorDate((current) =>
      viewMode === "week"
        ? addWeeks(current, direction)
        : addMonths(current, direction),
    );
  }

  function handleSpaceFilterToggle(spaceId: string) {
    setFilterSpaceId((current) => (current === spaceId ? null : spaceId));
  }

  const filterSpaceName = filterSpaceId
    ? spaces.find((space) => space.id === filterSpaceId)?.name
    : null;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "week" ? "default" : "outline"}
            onClick={() => setViewMode("week")}
            className="gap-1.5"
          >
            <Rows3 className="h-4 w-4" />
            Semanal
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "month" ? "default" : "outline"}
            onClick={() => setViewMode("month")}
            className="gap-1.5"
          >
            <LayoutGrid className="h-4 w-4" />
            Mensual
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              today.setHours(12, 0, 0, 0);
              setAnchorDate(today);
              setSelectedDate(today);
            }}
          >
            Hoy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate(1)}
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm font-medium text-muted-foreground">
        {viewMode === "week"
          ? `Semana: ${formatWeekRange(anchorDate)}`
          : formatMonthYear(anchorDate)}
      </p>

      {isAdmin && pendingCount > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Hay <strong>{pendingCount}</strong> solicitud(es) pendientes de autorización.{" "}
          <Link href="/admin/aprobaciones" className="font-medium underline">
            Revisar aprobaciones
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {areas.map((area) => {
          const color = getAreaColor(area);
          return (
            <span
              key={area.id}
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs"
            >
              <span className={cn("h-2 w-2 rounded-full", color.dot)} />
              {area.name}
            </span>
          );
        })}
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,360px)_1fr]">
        <div className="min-w-0 space-y-3">
          {maps.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="calendarMap">Mapa</Label>
              <Select
                id="calendarMap"
                value={mapId}
                onChange={(event) => {
                  setMapId(event.target.value);
                  setFilterSpaceId(null);
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
              spaceStatuses={{}}
              selectedSpaceIds={filterSpaceId ? [filterSpaceId] : []}
              onSpaceToggle={handleSpaceFilterToggle}
              compact
            />
          ) : null}

          {filterSpaceId && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <span>
                Filtro: <strong>{filterSpaceName}</strong>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setFilterSpaceId(null)}
                className="gap-1"
              >
                <FilterX className="h-4 w-4" />
                Limpiar
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Toca un espacio en el mapa para filtrar el calendario.
          </p>
        </div>

        <div className="min-w-0 space-y-4">
          {viewMode === "week" ? (
            <WeekView
              anchorDate={anchorDate}
              selectedDate={selectedDate}
              reservations={filteredReservations}
              datesWithEvents={datesWithEvents}
              areas={areas}
              onSelectDate={setSelectedDate}
            />
          ) : (
            <MonthView
              anchorDate={anchorDate}
              selectedDate={selectedDate}
              reservations={filteredReservations}
              datesWithEvents={datesWithEvents}
              areas={areas}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setAnchorDate(date);
              }}
            />
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold capitalize">
                {formatDateDisplay(selectedDate)}
              </h3>
              {canReserve && (
                <Button asChild size="sm">
                  <Link
                    href={`/reserva?date=${formatDateISO(selectedDate)}`}
                  >
                    Reservar
                  </Link>
                </Button>
              )}
            </div>

            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay reservas para este día
                {filterSpaceId ? " en el espacio seleccionado" : ""}.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((reservation) => {
                  const color = getReservationAreaColor(reservation, areas);
                  const areaName =
                    areaNameById.get(reservation.areaId) ?? "Sin área";
                  const statusLabel = reservationStatusLabel(reservation);

                  return (
                  <article
                    key={reservation.id}
                    className={cn(
                      "rounded-lg border p-3",
                      color.bg,
                      color.border,
                      statusLabel && "border-dashed",
                    )}
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
                      <div className="flex flex-wrap gap-1">
                        {statusLabel && (
                          <Badge variant="outline">{statusLabel}</Badge>
                        )}
                        <Badge variant="secondary">{reservation.status}</Badge>
                      </div>
                    </div>
                    {reservation.eventDescription && (
                      <p className="mt-2 text-sm">{reservation.eventDescription}</p>
                    )}
                    <p className="mt-2 text-sm">
                      <span className="text-muted-foreground">Área: </span>
                      {areaName}
                    </p>
                    <p className="mt-1 text-sm">
                      <span className="text-muted-foreground">Espacios: </span>
                      {reservation.spaceNames.join(", ")}
                    </p>
                    {reservation.resources.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {reservation.resources
                          .map((r) => `${r.resourceName} ×${r.quantity}`)
                          .join(", ")}
                      </p>
                    )}
                  </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
