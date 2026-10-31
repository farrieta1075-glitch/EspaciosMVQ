"use client";

import * as React from "react";
import type { Area } from "@/types/area";
import type { Space } from "@/types/space";
import type { RecurrenceType } from "@/types/reservation";
import { ATTENDEE_JUSTIFICATION_OPTIONS } from "@/lib/attendee-justification";
import { reservationNeedsAttendeeJustification } from "@/lib/capacity-validation";
import { addMonths, formatDateISO, formatDateDisplay } from "@/lib/date-utils";
import { listRecurrenceDates } from "@/lib/recurrence";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getAreaHex } from "@/lib/area-colors";
import { cn } from "@/lib/utils";

export interface EventPresetGroup {
  id: string;
  label: string;
  parentLabel: string | null;
  colorHex: string;
  events: string[];
}

interface EventFormProps {
  eventName: string;
  onEventNameChange: (value: string) => void;
  eventDescription: string;
  onEventDescriptionChange: (value: string) => void;
  recurrenceType: RecurrenceType;
  onRecurrenceTypeChange: (value: RecurrenceType) => void;
  recurrenceUntil: string;
  onRecurrenceUntilChange: (value: string) => void;
  recurrenceExceptDates: string[];
  onRecurrenceExceptDatesChange: (value: string[]) => void;
  sendEventReminder: boolean;
  onSendEventReminderChange: (value: boolean) => void;
  baseDate: string;
  areaId: string;
  onAreaIdChange: (value: string) => void;
  areas: Area[];
  isAdmin: boolean;
  disabled?: boolean;
  hideRecurrence?: boolean;
  hideEventReminder?: boolean;
  hideAdminArea?: boolean;
  bare?: boolean;
  estimatedAttendees: string;
  onEstimatedAttendeesChange: (value: string) => void;
  attendeeJustificationCode: string;
  onAttendeeJustificationCodeChange: (value: string) => void;
  attendeeJustificationNote: string;
  onAttendeeJustificationNoteChange: (value: string) => void;
  selectedSpaceIds?: string[];
  spaces?: Space[];
  eventPresetGroups?: EventPresetGroup[];
  eventPresetAreaOptions?: { id: string; label: string; depth: number }[];
  presetsByAreaId?: Record<string, string[]>;
  presetSourceAreaId?: string;
  onPresetSourceAreaIdChange?: (areaId: string) => void;
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
  recurrenceExceptDates,
  onRecurrenceExceptDatesChange,
  sendEventReminder,
  onSendEventReminderChange,
  baseDate,
  areaId,
  onAreaIdChange,
  areas,
  isAdmin,
  disabled = false,
  hideRecurrence = false,
  hideEventReminder = false,
  hideAdminArea = false,
  bare = false,
  estimatedAttendees,
  onEstimatedAttendeesChange,
  attendeeJustificationCode,
  onAttendeeJustificationCodeChange,
  attendeeJustificationNote,
  onAttendeeJustificationNoteChange,
  selectedSpaceIds = [],
  spaces = [],
  eventPresetGroups = [],
  eventPresetAreaOptions = [],
  presetsByAreaId = {},
  presetSourceAreaId,
  onPresetSourceAreaIdChange,
}: EventFormProps) {
  const [internalPresetAreaId, setInternalPresetAreaId] = React.useState("");
  const activePresetAreaId =
    presetSourceAreaId ?? internalPresetAreaId ?? areaId ?? eventPresetAreaOptions[0]?.id ?? "";
  const presetEvents =
    presetsByAreaId[activePresetAreaId] ??
    eventPresetGroups.find((group) => group.id === activePresetAreaId)?.events ??
    [];

  React.useEffect(() => {
    if (presetSourceAreaId !== undefined) return;
    if (areaId && presetsByAreaId[areaId]?.length) {
      setInternalPresetAreaId(areaId);
    } else if (eventPresetAreaOptions[0]?.id) {
      setInternalPresetAreaId(eventPresetAreaOptions[0].id);
    }
  }, [areaId, eventPresetAreaOptions, presetSourceAreaId, presetsByAreaId]);

  function setPresetAreaId(next: string) {
    onPresetSourceAreaIdChange?.(next);
    if (presetSourceAreaId === undefined) {
      setInternalPresetAreaId(next);
    }
  }

  const [suggestions, setSuggestions] = React.useState<
    { eventName: string; count: number }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [showExceptionPicker, setShowExceptionPicker] = React.useState(false);

  const plannedDates = React.useMemo(
    () =>
      recurrenceType === "NONE" || !baseDate || !recurrenceUntil
        ? []
        : listRecurrenceDates(baseDate, recurrenceType, recurrenceUntil),
    [baseDate, recurrenceType, recurrenceUntil],
  );

  const exceptSet = React.useMemo(
    () => new Set(recurrenceExceptDates),
    [recurrenceExceptDates],
  );

  const selectedSpacesCapacity = React.useMemo(() => {
    return spaces.filter((space) => selectedSpaceIds.includes(space.id));
  }, [spaces, selectedSpaceIds]);

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

  React.useEffect(() => {
    if (plannedDates.length === 0) {
      if (recurrenceExceptDates.length > 0) {
        onRecurrenceExceptDatesChange([]);
      }
      return;
    }
    const allowed = new Set(plannedDates);
    const filtered = recurrenceExceptDates.filter((date) => allowed.has(date));
    if (filtered.length !== recurrenceExceptDates.length) {
      onRecurrenceExceptDatesChange(filtered);
    }
  }, [
    plannedDates,
    recurrenceExceptDates,
    onRecurrenceExceptDatesChange,
  ]);

  const estimatedNumber = Number(estimatedAttendees);
  const showJustification = reservationNeedsAttendeeJustification(
    spaces,
    selectedSpaceIds,
    estimatedNumber,
  );

  const fields = (
        <div className="space-y-4">
        {(eventPresetAreaOptions.length > 0 || eventPresetGroups.length > 0) &&
          presetEvents.length > 0 && (
          <div className="space-y-2">
            <Label>Eventos sugeridos</Label>
            {eventPresetAreaOptions.length > 1 && (
              <div className="space-y-1">
                <Label htmlFor="presetArea" className="text-xs text-muted-foreground">
                  Área o subárea
                </Label>
                <Select
                  id="presetArea"
                  value={activePresetAreaId}
                  disabled={disabled}
                  onChange={(event) => setPresetAreaId(event.target.value)}
                >
                  {eventPresetAreaOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {presetEvents.map((preset) => {
                const areaForColor =
                  areas.find((item) => item.id === activePresetAreaId) ?? null;
                const hex = getAreaHex(areaForColor, areas);
                return (
                  <Button
                    key={`${activePresetAreaId}-${preset}`}
                    type="button"
                    size="sm"
                    variant={
                      eventName.trim() === preset ? "default" : "outline"
                    }
                    className="h-7 gap-1.5 text-xs"
                    disabled={disabled}
                    onClick={() => onEventNameChange(preset)}
                  >
                    <span
                      className="h-2 w-2 rounded-full ring-1 ring-border"
                      style={{ backgroundColor: hex }}
                      aria-hidden
                    />
                    {preset}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Incluye eventos del área seleccionada y de sus subáreas. También
              puedes escribir otro nombre abajo.
            </p>
          </div>
        )}

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

        <div className="space-y-2">
          <Label htmlFor="estimatedAttendees">Asistentes estimados</Label>
          <Input
            id="estimatedAttendees"
            type="number"
            min={1}
            value={estimatedAttendees}
            disabled={disabled}
            onChange={(event) => onEstimatedAttendeesChange(event.target.value)}
            placeholder="Ej. 25"
            required
          />
        </div>

        {showJustification && (
          <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <p className="text-sm font-medium">
              Justificación de cantidad de asistentes
            </p>
            <p className="text-xs text-muted-foreground">
              La estimación está fuera de la capacidad mínima o máxima de al
              menos un espacio seleccionado.
            </p>
            {selectedSpacesCapacity.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {selectedSpacesCapacity.map((space) => {
                  const max =
                    space.capacity > 0 ? space.capacity : "sin máximo";
                  const min = space.minCapacity > 0 ? space.minCapacity : 1;
                  return (
                    <li key={space.id}>
                      {space.name}: mín. {min}, máx. {max}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="space-y-2">
              <Label htmlFor="attendeeJustification">Motivo</Label>
              <Select
                id="attendeeJustification"
                value={attendeeJustificationCode}
                disabled={disabled}
                onChange={(event) =>
                  onAttendeeJustificationCodeChange(event.target.value)
                }
                required
              >
                <option value="">Selecciona una opción</option>
                {ATTENDEE_JUSTIFICATION_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            {attendeeJustificationCode === "OTHER" && (
              <div className="space-y-2">
                <Label htmlFor="attendeeJustificationNote">Explica</Label>
                <textarea
                  id="attendeeJustificationNote"
                  value={attendeeJustificationNote}
                  disabled={disabled}
                  onChange={(event) =>
                    onAttendeeJustificationNoteChange(event.target.value)
                  }
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Describe la justificación..."
                  required
                />
              </div>
            )}
          </div>
        )}

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
          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className={cn("text-xs text-muted-foreground")}>
              Se crearán reservas{" "}
              {recurrenceType === "DAILY" ? "diarias" : "semanales"} hasta la
              fecha indicada (máx. 52).
              {exceptSet.size > 0
                ? ` Excluidas: ${exceptSet.size} fecha(s).`
                : ""}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showExceptionPicker}
                onChange={(event) => setShowExceptionPicker(event.target.checked)}
                className="rounded border-border"
                disabled={disabled || plannedDates.length === 0}
              />
              Definir excepciones (días sin reserva)
            </label>
            {showExceptionPicker && plannedDates.length > 0 && (
              <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {plannedDates.map((isoDate) => {
                  const isException = exceptSet.has(isoDate);
                  const [y, m, d] = isoDate.split("-").map(Number);
                  const label = formatDateDisplay(new Date(y, m - 1, d));
                  return (
                    <li key={isoDate}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isException}
                          disabled={disabled}
                          onChange={(event) => {
                            const next = new Set(recurrenceExceptDates);
                            if (event.target.checked) next.add(isoDate);
                            else next.delete(isoDate);
                            onRecurrenceExceptDatesChange([...next]);
                          }}
                          className="rounded border-border"
                        />
                        <span
                          className={cn(
                            isException && "text-muted-foreground line-through",
                          )}
                        >
                          {label}
                          {isException ? " (excepción)" : ""}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-[11px] text-muted-foreground">
              Marca las fechas que no deben generarse. Si luego necesitas
              cancelar una reserva ya creada, hazlo de forma individual.
            </p>
          </div>
        )}

        {!hideEventReminder && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendEventReminder}
              onChange={(event) =>
                onSendEventReminderChange(event.target.checked)
              }
              className="mt-0.5 rounded border-border"
              disabled={disabled}
            />
            <span>
              Enviar recordatorio de reserva (notificación in-app 1 día antes,
              con espacios, horario y asistentes estimados)
            </span>
          </label>
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
              {areas.map((area) => {
                const parent = area.parentId
                  ? areas.find((item) => item.id === area.parentId)
                  : null;
                const label = parent
                  ? `${parent.name} · ${area.name}`
                  : area.name;
                return (
                  <option key={area.id} value={area.id}>
                    {label}
                  </option>
                );
              })}
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
