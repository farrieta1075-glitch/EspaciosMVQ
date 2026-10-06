"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Area } from "@/types/area";
import type { FloorMap, Space } from "@/types/space";
import type { ReservationDetail } from "@/types/reservation";
import { AreaLegendToggle } from "@/components/calendar/area-legend-toggle";
import { CalendarDaySheet } from "@/components/calendar/calendar-day-sheet";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { Button } from "@/components/ui/button";
import {
  addMonths,
  addWeeks,
  formatDateISO,
  getWeekDays,
  isSameMonth,
} from "@/lib/date-utils";
import { canSelectCalendarDay } from "@/lib/calendar-date-selection";
import { setPickedReservationDate } from "@/lib/reservation-draft-storage";
import type { SessionUser, UserRole } from "@/types/user";

type CalendarViewMode = "week" | "month";

interface CalendarClientProps {
  reservations: ReservationDetail[];
  maps: FloorMap[];
  spaces: Space[];
  areas: Area[];
  isAdmin: boolean;
  canReserve: boolean;
  viewerAreaId: string | null;
  viewerRole: UserRole;
  viewerUser: SessionUser | null;
  initialDate?: string;
  initialMapId?: string;
  initialSpaceId?: string;
  pickMode?: boolean;
  returnTo?: string;
}

function reservationsInVisiblePeriod(
  reservations: ReservationDetail[],
  anchorDate: Date,
  viewMode: CalendarViewMode,
): ReservationDetail[] {
  if (viewMode === "week") {
    const days = getWeekDays(anchorDate);
    const start = new Date(days[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(days[6]);
    end.setHours(23, 59, 59, 999);
    return reservations.filter((reservation) => {
      const t = new Date(reservation.startAt).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
  }
  return reservations.filter((reservation) =>
    isSameMonth(new Date(reservation.startAt), anchorDate),
  );
}

export function CalendarClient({
  reservations,
  maps,
  spaces,
  areas,
  isAdmin,
  canReserve,
  viewerAreaId,
  viewerRole,
  viewerUser,
  initialDate,
  initialMapId,
  initialSpaceId,
  pickMode = false,
  returnTo,
}: CalendarClientProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>("month");
  const [showAreaLegend, setShowAreaLegend] = React.useState(false);
  const [anchorDate, setAnchorDate] = React.useState(() => {
    if (initialDate) {
      const [y, m, d] = initialDate.split("-").map(Number);
      if (y && m && d) return new Date(y, m - 1, d, 12);
    }
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today;
  });
  const [sheetDate, setSheetDate] = React.useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetSelectionHint, setSheetSelectionHint] = React.useState<{
    mapId?: string;
    spaceId?: string;
  } | null>(null);

  const pendingCount = React.useMemo(
    () => reservations.filter((reservation) => reservation.needsApproval).length,
    [reservations],
  );

  const activeReservations = React.useMemo(
    () => reservations.filter((reservation) => reservation.status !== "CANCELLED"),
    [reservations],
  );

  const isDateSelectable = React.useCallback(
    (day: Date) =>
      canSelectCalendarDay(day, {
        isAdmin,
        viewerRole,
        viewerUser,
        reservations: activeReservations,
        pickMode,
      }),
    [activeReservations, isAdmin, pickMode, viewerRole, viewerUser],
  );

  React.useEffect(() => {
    if (pickMode || !initialDate) return;
    const [y, m, d] = initialDate.split("-").map(Number);
    if (y && m && d) {
      const date = new Date(y, m - 1, d, 12);
      if (!isDateSelectable(date)) return;
      setSheetDate(date);
      setSheetOpen(true);
      setSheetSelectionHint({
        mapId: initialMapId,
        spaceId: initialSpaceId,
      });
    }
  }, [
    initialDate,
    initialMapId,
    initialSpaceId,
    pickMode,
    isDateSelectable,
  ]);

  const datesWithEvents = React.useMemo(() => {
    const set = new Set<string>();
    for (const reservation of activeReservations) {
      set.add(formatDateISO(new Date(reservation.startAt)));
    }
    return set;
  }, [activeReservations]);

  const areasInView = React.useMemo(() => {
    const visible = reservationsInVisiblePeriod(
      activeReservations,
      anchorDate,
      viewMode,
    );
    const ids = new Set<string>();
    for (const reservation of visible) {
      if (reservation.areaId) ids.add(reservation.areaId);
    }
    return areas.filter((area) => ids.has(area.id));
  }, [activeReservations, anchorDate, areas, viewMode]);

  function navigate(direction: -1 | 1) {
    setAnchorDate((current) =>
      viewMode === "week"
        ? addWeeks(current, direction)
        : addMonths(current, direction),
    );
  }

  function openDaySheet(date: Date) {
    setSheetDate(date);
    setSheetSelectionHint(null);
    setSheetOpen(true);
  }

  function handleSelectDate(date: Date) {
    if (!isDateSelectable(date)) return;
    if (pickMode && returnTo) {
      setPickedReservationDate(formatDateISO(date));
      router.push(returnTo);
      return;
    }
    openDaySheet(date);
  }

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
        {!pickMode && (
          <AreaLegendToggle
            areas={areasInView}
            show={showAreaLegend}
            onToggle={() => setShowAreaLegend((value) => !value)}
            className="sm:items-end"
          />
        )}
      </header>

      {pickMode && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Toca un día para cambiar la fecha de tu reserva. Volverás al formulario
          sin perder lo que ya capturaste.
        </div>
      )}

      {isAdmin && pendingCount > 0 && !pickMode && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Hay <strong>{pendingCount}</strong> solicitud(es) pendientes de autorización.{" "}
          <Link href="/admin/aprobaciones" className="font-medium underline">
            Revisar aprobaciones
          </Link>
        </div>
      )}

      {viewMode === "week" ? (
        <WeekView
          anchorDate={anchorDate}
          selectedDate={sheetDate ?? anchorDate}
          reservations={activeReservations}
          areas={areas}
          onSelectDate={handleSelectDate}
          isDateSelectable={isDateSelectable}
        />
      ) : (
        <MonthView
          anchorDate={anchorDate}
          selectedDate={sheetDate ?? anchorDate}
          reservations={activeReservations}
          datesWithEvents={datesWithEvents}
          areas={areas}
          onSelectDate={handleSelectDate}
          isDateSelectable={isDateSelectable}
        />
      )}

      <div className="grid grid-cols-4 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-full shrink-0"
          onClick={() => navigate(-1)}
          aria-label="Periodo anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={viewMode === "month" ? "default" : "outline"}
          className="h-10 px-1 text-xs sm:text-sm"
          onClick={() => setViewMode("month")}
        >
          Mensual
        </Button>
        <Button
          type="button"
          size="sm"
          variant={viewMode === "week" ? "default" : "outline"}
          className="h-10 px-1 text-xs sm:text-sm"
          onClick={() => setViewMode("week")}
        >
          Semanal
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-full shrink-0"
          onClick={() => navigate(1)}
          aria-label="Periodo siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {canReserve && !pickMode && (
        <Button asChild className="h-11 w-full text-base">
          <Link href="/reserva">Reservar</Link>
        </Button>
      )}

      {!pickMode && (
        <CalendarDaySheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          date={sheetDate}
          reservations={activeReservations}
          maps={maps}
          spaces={spaces}
          areas={areas}
          viewerAreaId={viewerAreaId}
          canReserve={canReserve}
          initialMapId={sheetSelectionHint?.mapId}
          initialSpaceId={sheetSelectionHint?.spaceId}
        />
      )}
    </div>
  );
}
