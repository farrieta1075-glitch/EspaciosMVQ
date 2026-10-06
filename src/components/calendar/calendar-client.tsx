"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Area } from "@/types/area";
import type { FloorMap, Space } from "@/types/space";
import type { ReservationDetail } from "@/types/reservation";
import { CalendarDaySheet } from "@/components/calendar/calendar-day-sheet";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { Button } from "@/components/ui/button";
import { formatDateISO, addMonths, addWeeks } from "@/lib/date-utils";

type CalendarViewMode = "week" | "month";

interface CalendarClientProps {
  reservations: ReservationDetail[];
  maps: FloorMap[];
  spaces: Space[];
  areas: Area[];
  isAdmin: boolean;
  canReserve: boolean;
  viewerAreaId: string | null;
  initialDate?: string;
}

export function CalendarClient({
  reservations,
  maps,
  spaces,
  areas,
  isAdmin,
  canReserve,
  viewerAreaId,
  initialDate,
}: CalendarClientProps) {
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>("month");
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

  const pendingCount = React.useMemo(
    () => reservations.filter((reservation) => reservation.needsApproval).length,
    [reservations],
  );

  const activeReservations = React.useMemo(
    () => reservations.filter((reservation) => reservation.status !== "CANCELLED"),
    [reservations],
  );

  const datesWithEvents = React.useMemo(() => {
    const set = new Set<string>();
    for (const reservation of activeReservations) {
      set.add(formatDateISO(new Date(reservation.startAt)));
    }
    return set;
  }, [activeReservations]);

  function navigate(direction: -1 | 1) {
    setAnchorDate((current) =>
      viewMode === "week"
        ? addWeeks(current, direction)
        : addMonths(current, direction),
    );
  }

  function openDaySheet(date: Date) {
    setSheetDate(date);
    setSheetOpen(true);
  }

  return (
    <div className="min-w-0 space-y-4">
      {isAdmin && pendingCount > 0 && (
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
          datesWithEvents={datesWithEvents}
          areas={areas}
          onSelectDate={openDaySheet}
        />
      ) : (
        <MonthView
          anchorDate={anchorDate}
          selectedDate={sheetDate ?? anchorDate}
          reservations={activeReservations}
          datesWithEvents={datesWithEvents}
          areas={areas}
          onSelectDate={openDaySheet}
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

      {canReserve && (
        <Button asChild className="h-11 w-full text-base">
          <Link href="/reserva">Reservar</Link>
        </Button>
      )}

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
      />
    </div>
  );
}
