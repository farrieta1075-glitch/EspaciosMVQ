"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addDays,
  addMonths,
  addWeeks,
  formatDateDisplay,
  formatDateISO,
  formatTimeDisplay,
  parseReservationDateTime,
} from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface DateNavigatorProps {
  date: Date;
  startTime: string;
  endTime: string;
  onDateChange: (date: Date) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  showCalendarLink?: boolean;
  variant?: "default" | "reservation";
  calendarHref?: string;
}

const navButtonClass = "h-8 w-8 shrink-0 sm:h-9 sm:w-9";

export function DateNavigator({
  date,
  startTime,
  endTime,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  showCalendarLink = true,
  variant = "default",
  calendarHref,
}: DateNavigatorProps) {
  const isoDate = formatDateISO(date);
  const startParsed =
    startTime &&
    parseReservationDateTime(`${isoDate}T${startTime}:00`);
  const endParsed =
    endTime && parseReservationDateTime(`${isoDate}T${endTime}:00`);
  const isReservation = variant === "reservation";

  if (isReservation) {
    return (
      <div className="space-y-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fecha seleccionada
          </p>
          <Link
            href={calendarHref ?? `/calendario?date=${isoDate}`}
            className={cn(
              "mt-0.5 block truncate text-base font-semibold",
              "text-primary underline-offset-4 hover:underline",
            )}
          >
            {formatDateDisplay(date)}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="startTime" className="text-xs">
              Hora inicio
            </Label>
            <Input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(event) => onStartTimeChange(event.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="endTime" className="text-xs">
              Hora fin
            </Label>
            <Input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(event) => onEndTimeChange(event.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fecha seleccionada
          </p>
          <p className="truncate text-sm font-medium sm:text-lg">
            {formatDateDisplay(date)}
          </p>
        </div>

        {showCalendarLink && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden shrink-0 gap-2 sm:inline-flex"
          >
            <Link href={`/calendario?date=${isoDate}`}>
              <CalendarDays className="h-4 w-4" />
              Ver calendario
            </Link>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={navButtonClass}
          aria-label="Mes anterior"
          onClick={() => onDateChange(addMonths(date, -1))}
        >
          <ChevronsLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={navButtonClass}
          aria-label="Semana anterior"
          onClick={() => onDateChange(addWeeks(date, -1))}
        >
          <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={navButtonClass}
          aria-label="Día anterior"
          onClick={() => onDateChange(addDays(date, -1))}
        >
          <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>

        <Input
          type="date"
          value={isoDate}
          onChange={(event) => {
            const [year, month, day] = event.target.value.split("-").map(Number);
            if (year && month && day) {
              onDateChange(new Date(year, month - 1, day));
            }
          }}
          className="h-8 min-w-0 flex-1 shrink px-1 text-xs sm:h-9 sm:w-[148px] sm:flex-none sm:px-3 sm:text-sm"
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          className={navButtonClass}
          aria-label="Día siguiente"
          onClick={() => onDateChange(addDays(date, 1))}
        >
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={navButtonClass}
          aria-label="Semana siguiente"
          onClick={() => onDateChange(addWeeks(date, 1))}
        >
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={navButtonClass}
          aria-label="Mes siguiente"
          onClick={() => onDateChange(addMonths(date, 1))}
        >
          <ChevronsRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </div>

      {showCalendarLink && (
        <Button asChild variant="outline" size="sm" className="w-full gap-2 sm:hidden">
          <Link href={`/calendario?date=${isoDate}`}>
            <CalendarDays className="h-4 w-4" />
            Ver calendario
          </Link>
        </Button>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startTime">Hora inicio</Label>
          <Input
            id="startTime"
            type="time"
            value={startTime}
            onChange={(event) => onStartTimeChange(event.target.value)}
          />
          {startParsed && (
            <p className="text-xs text-muted-foreground">
              {formatTimeDisplay(startParsed)}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">Hora fin</Label>
          <Input
            id="endTime"
            type="time"
            value={endTime}
            onChange={(event) => onEndTimeChange(event.target.value)}
          />
          {endParsed && (
            <p className="text-xs text-muted-foreground">
              {formatTimeDisplay(endParsed)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
