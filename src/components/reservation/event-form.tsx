"use client";

import * as React from "react";
import type { Area } from "@/types/area";
import type { RecurrenceType } from "@/types/reservation";
import { addMonths, formatDateISO } from "@/lib/date-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface EventFormProps {
  eventName: string;
  onEventNameChange: (value: string) => void;
  eventDescription: string;
  onEventDescriptionChange: (value: string) => void;
  recurrenceType: RecurrenceType;
  onRecurrenceTypeChange: (value: RecurrenceType) => void;
  recurrenceUntil: string;
  onRecurrenceUntilChange: (value: string) => void;
  baseDate: string;
  areaId: string;
  onAreaIdChange: (value: string) => void;
  areas: Area[];
  isAdmin: boolean;
  disabled?: boolean;
  hideRecurrence?: boolean;
  hideAdminArea?: boolean;
  bare?: boolean;
}

export function EventForm({
  eventName,
  onEventNameChange,
  eventDescription,
  onEventDescriptionChange,
  recurrenceType,
  onRecurrenceTypeChange,
  recurrenceUntil,
  onRecurrenceUntilChange,
  baseDate,
  areaId,
  onAreaIdChange,
  areas,
  isAdmin,
  disabled = false,
  hideRecurrence = false,
  hideAdminArea = false,
  bare = false,
}: EventFormProps) {
  const [suggestions, setSuggestions] = React.useState<
    { eventName: string; count: number }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  React.useEffect(() => {
    if (eventName.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const response = await fetch(
        `/api/reservas/event-suggestions?q=${encodeURIComponent(eventName)}`,
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [eventName]);

  React.useEffect(() => {
    if (recurrenceType === "NONE") return;
    if (!recurrenceUntil) {
      const base = baseDate
        ? new Date(`${baseDate}T12:00:00`)
        : new Date();
      onRecurrenceUntilChange(formatDateISO(addMonths(base, 1)));
    }
  }, [recurrenceType, recurrenceUntil, baseDate, onRecurrenceUntilChange]);

  const fields = (
        <div className="space-y-4">
        <div className="relative space-y-2">
          <Label htmlFor="eventName">Nombre del evento</Label>
          <Input
            id="eventName"
            value={eventName}
            disabled={disabled}
            onChange={(event) => onEventNameChange(event.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Ej. Junta de equipo, Capacitación..."
            autoComplete="off"
            required
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
              {suggestions.map((item) => (
                <li key={item.eventName}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onEventNameChange(item.eventName);
                      setShowSuggestions(false);
                    }}
                  >
                    <span>{item.eventName}</span>
                    <span className="text-xs text-muted-foreground">
                      ×{item.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="eventDescription">Descripción del evento</Label>
          <textarea
            id="eventDescription"
            value={eventDescription}
            disabled={disabled}
            onChange={(event) => onEventDescriptionChange(event.target.value)}
            placeholder="Explica de qué se trata el evento, participantes, necesidades..."
            rows={4}
            className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!hideRecurrence && (
            <div className="space-y-2">
              <Label htmlFor="recurrenceType">Recurrencia</Label>
              <Select
                id="recurrenceType"
                value={recurrenceType}
                disabled={disabled}
                onChange={(event) =>
                  onRecurrenceTypeChange(event.target.value as RecurrenceType)
                }
              >
                <option value="NONE">Sin recurrencia</option>
                <option value="DAILY">Diaria</option>
                <option value="WEEKLY">Semanal</option>
              </Select>
            </div>
          )}

          {!hideRecurrence && recurrenceType !== "NONE" && (
            <div className="space-y-2">
              <Label htmlFor="recurrenceUntil">Repetir hasta</Label>
              <Input
                id="recurrenceUntil"
                type="date"
                value={recurrenceUntil}
                min={baseDate}
                disabled={disabled}
                onChange={(event) =>
                  onRecurrenceUntilChange(event.target.value)
                }
                required
              />
            </div>
          )}
        </div>

        {!hideRecurrence && recurrenceType !== "NONE" && (
          <p className={cn("text-xs text-muted-foreground")}>
            Se crearán reservas {recurrenceType === "DAILY" ? "diarias" : "semanales"} hasta la fecha indicada (máx. 52).
          </p>
        )}

        {isAdmin && !hideAdminArea && (
          <div className="space-y-2">
            <Label htmlFor="areaId">Área</Label>
            <Select
              id="areaId"
              value={areaId}
              disabled={disabled}
              onChange={(event) => onAreaIdChange(event.target.value)}
            >
              <option value="">Selecciona área</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        </div>
  );

  if (bare) {
    return fields;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del evento</CardTitle>
        <CardDescription>
          Nombre, descripción y recurrencia de la reserva.
        </CardDescription>
      </CardHeader>
      <CardContent>{fields}</CardContent>
    </Card>
  );
}
