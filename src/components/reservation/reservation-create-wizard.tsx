"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import type { Area } from "@/types/area";
import type { FloorMap, Space } from "@/types/space";
import type {
  MapDateSelection,
  RecurrenceConfig,
  RecurrenceType,
} from "@/types/reservation";
import { ReservationAreaTreePicker } from "@/components/reservation/reservation-area-tree-picker";
import {
  MapDateSelector,
  type InitialMapSelection,
} from "@/components/map-date/map-date-selector";
import {
  buildReservationAreaTree,
  flattenSelectableAreaIds,
  getAreaLabel,
} from "@/lib/reservation-area-tree";
import {
  inferMonthlyRelativeFromDate,
  needsFourthVsLastPrompt,
  weekdayNameEs,
} from "@/lib/monthly-relative-recurrence";
import {
  RECURRENCE_TYPE_LABELS,
  listRecurrenceDates,
} from "@/lib/recurrence";
import { ATTENDEE_JUSTIFICATION_OPTIONS } from "@/lib/attendee-justification";
import { reservationNeedsAttendeeJustification } from "@/lib/capacity-validation";
import { formatDateDisplay, formatDateISO } from "@/lib/date-utils";
import { addMinutesToTimeHHmm } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { EventPresetGroup } from "@/components/reservation/event-form";

function ContinueButton({
  visible,
  onClick,
  label = "Continuar »",
}: {
  visible: boolean;
  onClick: () => void;
  label?: string;
}) {
  if (!visible) return null;
  return (
    <Button type="button" size="sm" className="mt-2" onClick={onClick}>
      {label}
    </Button>
  );
}

interface ReservationCreateWizardProps {
  maps: FloorMap[];
  spaces: Space[];
  areas: Area[];
  isAdmin: boolean;
  userAreaId: string | null;
  userAreaScopeIds: string[];
  initialDate?: string;
  initialMapId?: string;
  initialSpaceId?: string;
  mapSelectorKey: number;
  restoredSelection?: InitialMapSelection;
  eventPresetGroups: EventPresetGroup[];
  presetsByAreaId: Record<string, string[]>;
  presetSourceAreaId: string;
  onPresetSourceAreaIdChange: (id: string) => void;
  onSelectionChange: (selection: MapDateSelection) => void;
  onReservationDatePick: () => void;
  resourcesOpen: boolean;
  onResourcesOpenChange: (open: boolean) => void;
  resourceCount: number;
  selection: MapDateSelection | null;
  onSubmit: () => void;
  canSubmit: boolean;
  loading: boolean;
  // controlled event fields from parent for draft/submit
  eventName: string;
  onEventNameChange: (v: string) => void;
  eventDescription: string;
  onEventDescriptionChange: (v: string) => void;
  estimatedAttendees: string;
  onEstimatedAttendeesChange: (v: string) => void;
  attendeeJustificationCode: string;
  onAttendeeJustificationCodeChange: (v: string) => void;
  attendeeJustificationNote: string;
  onAttendeeJustificationNoteChange: (v: string) => void;
  recurrence: RecurrenceConfig;
  onRecurrenceChange: (v: RecurrenceConfig) => void;
  sendEventReminder: boolean;
  onSendEventReminderChange: (v: boolean) => void;
  areaId: string;
  onAreaIdChange: (v: string) => void;
  reservationAreaId: string;
  onReservationAreaIdChange: (v: string) => void;
}

export function ReservationCreateWizard(props: ReservationCreateWizardProps) {
  const {
    maps,
    spaces,
    areas,
    isAdmin,
    userAreaScopeIds,
    userAreaId,
    initialDate,
    initialMapId,
    initialSpaceId,
    mapSelectorKey,
    restoredSelection,
    presetsByAreaId,
    onSelectionChange,
    onReservationDatePick,
    resourcesOpen,
    onResourcesOpenChange,
    resourceCount,
    selection,
    onSubmit,
    canSubmit,
    loading,
    eventName,
    onEventNameChange,
    eventDescription,
    onEventDescriptionChange,
    estimatedAttendees,
    onEstimatedAttendeesChange,
    attendeeJustificationCode,
    onAttendeeJustificationCodeChange,
    attendeeJustificationNote,
    onAttendeeJustificationNoteChange,
    recurrence,
    onRecurrenceChange,
    sendEventReminder,
    onSendEventReminderChange,
    areaId,
    onAreaIdChange,
    reservationAreaId,
    onReservationAreaIdChange,
  } = props;

  const selectableIds = isAdmin
    ? areas.map((a) => a.id)
    : userAreaScopeIds.length > 0
      ? userAreaScopeIds
      : userAreaId
        ? [userAreaId]
        : [];

  const tree = buildReservationAreaTree(areas, {
    isAdmin,
    selectableAreaIds: new Set(selectableIds),
  });
  const flatSelectable = flattenSelectableAreaIds(tree);
  const showAreaPicker = isAdmin ? areas.length > 1 : flatSelectable.length > 1;
  const activeAreaId = isAdmin
    ? areaId
    : reservationAreaId || flatSelectable[0] || userAreaId || "";

  const [confirmed, setConfirmed] = React.useState({
    area: !showAreaPicker,
    eventName: false,
    eventDescription: false,
    attendees: false,
    recurrence: false,
    reminder: false,
    scheduleCollapsed: false,
    date: false,
    time: false,
  });

  const [customDateDraft, setCustomDateDraft] = React.useState("");
  const [relativeDisambiguation, setRelativeDisambiguation] = React.useState<
    "FOURTH" | "LAST" | null
  >(null);

  React.useEffect(() => {
    if (!showAreaPicker && flatSelectable[0]) {
      if (isAdmin) onAreaIdChange(flatSelectable[0]);
      else onReservationAreaIdChange(flatSelectable[0]);
      setConfirmed((c) => ({ ...c, area: true }));
    }
  }, [
    showAreaPicker,
    flatSelectable,
    isAdmin,
    onAreaIdChange,
    onReservationAreaIdChange,
  ]);

  const presets =
    presetsByAreaId[activeAreaId] ?? presetsByAreaId[areaId] ?? [];

  const reservationDate =
    selection?.date ??
    restoredSelection?.date ??
    initialDate ??
    formatDateISO(new Date());

  const [draftStart, setDraftStart] = React.useState(
    selection?.startTime ?? restoredSelection?.startTime ?? "08:00",
  );
  const [draftEnd, setDraftEnd] = React.useState(
    selection?.endTime ??
      restoredSelection?.endTime ??
      addMinutesToTimeHHmm("08:00", 60),
  );
  const [editingTime, setEditingTime] = React.useState(true);

  const startTime = selection?.startTime ?? draftStart;
  const endTime = selection?.endTime ?? draftEnd;

  const estimatedNumber = Number(estimatedAttendees);
  const needsJustification =
    selection &&
    reservationNeedsAttendeeJustification(
      spaces,
      selection.selectedSpaceIds,
      estimatedNumber,
    );

  const areaResolved = confirmed.area && Boolean(activeAreaId);
  const eventDetailsDone = confirmed.reminder;

  function confirmArea() {
    if (!activeAreaId) return;
    setConfirmed((c) => ({ ...c, area: true }));
  }

  function applyMonthlyRelativeFromDate(dateIso: string) {
    if (recurrence.type !== "MONTHLY_RELATIVE") return;
    const inferred = inferMonthlyRelativeFromDate(dateIso);
    if (needsFourthVsLastPrompt(dateIso) && !relativeDisambiguation) return;
    const ordinal =
      needsFourthVsLastPrompt(dateIso) && relativeDisambiguation
        ? relativeDisambiguation
        : inferred.ordinal;
    onRecurrenceChange({
      ...recurrence,
      monthlyRelative: { weekday: inferred.weekday, ordinal },
    });
  }

  React.useEffect(() => {
    if (confirmed.date && recurrence.type === "MONTHLY_RELATIVE") {
      applyMonthlyRelativeFromDate(reservationDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed.date, reservationDate, recurrence.type, relativeDisambiguation]);

  const activeHighlightAreaId = activeAreaId;

  const recurrencePreview =
    recurrence.type !== "NONE" && recurrence.type !== "CUSTOM" && confirmed.date
      ? listRecurrenceDates(
          reservationDate,
          recurrence.type,
          recurrence.until,
          recurrence,
        )
      : recurrence.type === "CUSTOM"
        ? recurrence.customDates ?? []
        : [];

  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* Área / subárea */}
      {showAreaPicker && !confirmed.area && (
        <section className="space-y-2">
          <Label className="text-sm font-medium">Área o subárea de la reserva</Label>
          <ReservationAreaTreePicker
            areas={areas}
            isAdmin={isAdmin}
            selectableAreaIds={selectableIds}
            value={activeAreaId}
            onChange={(id) => {
              if (isAdmin) onAreaIdChange(id);
              else onReservationAreaIdChange(id);
            }}
          />
          <ContinueButton
            visible={Boolean(activeAreaId)}
            onClick={confirmArea}
          />
        </section>
      )}

      {areaResolved && showAreaPicker && confirmed.area && (
        <p className="text-sm text-muted-foreground">
          Área:{" "}
          <span className="font-medium text-foreground">
            {getAreaLabel(
              areas.find((a) => a.id === activeAreaId) ?? {
                id: activeAreaId,
                name: activeAreaId,
                code: "",
                parentId: null,
                colorHex: "",
                eventPresets: [],
              },
              areas,
            )}
          </span>
        </p>
      )}

      {!showAreaPicker && areaResolved && (
        <p className="text-sm">
          Área:{" "}
          <span className="font-medium">
            {getAreaLabel(
              areas.find((a) => a.id === activeAreaId)!,
              areas,
            )}
          </span>
        </p>
      )}

      {areaResolved && !eventDetailsDone && (
        <section className="space-y-4 rounded-lg border border-border p-3">
          {!confirmed.eventName && (
            <div className="space-y-2">
              <Label htmlFor="wiz-eventName">Nombre del evento</Label>
              <Input
                id="wiz-eventName"
                value={eventName}
                onChange={(e) => onEventNameChange(e.target.value)}
                list="wiz-event-presets"
              />
              <datalist id="wiz-event-presets">
                {presets.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((name) => (
                    <Button
                      key={name}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        onEventNameChange(name);
                        setConfirmed((c) => ({ ...c, eventName: true }));
                      }}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
              )}
              <ContinueButton
                visible={eventName.trim().length >= 3}
                onClick={() =>
                  setConfirmed((c) => ({ ...c, eventName: true }))
                }
              />
            </div>
          )}

          {confirmed.eventName && !confirmed.eventDescription && (
            <div className="space-y-2">
              <Label htmlFor="wiz-eventDesc">Descripción del evento</Label>
              <textarea
                id="wiz-eventDesc"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={eventDescription}
                onChange={(e) => onEventDescriptionChange(e.target.value)}
              />
              <ContinueButton
                visible={eventDescription.trim().length >= 3}
                onClick={() =>
                  setConfirmed((c) => ({ ...c, eventDescription: true }))
                }
              />
            </div>
          )}

          {confirmed.eventDescription && !confirmed.attendees && (
            <div className="space-y-2">
              <Label htmlFor="wiz-attendees">Asistentes estimados</Label>
              <Input
                id="wiz-attendees"
                type="number"
                min={1}
                value={estimatedAttendees}
                onChange={(e) => onEstimatedAttendeesChange(e.target.value)}
              />
              <ContinueButton
                visible={estimatedNumber > 0}
                onClick={() => setConfirmed((c) => ({ ...c, attendees: true }))}
              />
            </div>
          )}

          {confirmed.attendees && !confirmed.recurrence && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="wiz-recurrence">Recurrencia</Label>
                <Select
                  id="wiz-recurrence"
                  value={recurrence.type}
                  onChange={(e) => {
                    const type = e.target.value as RecurrenceType;
                    onRecurrenceChange({
                      ...recurrence,
                      type,
                      customDates: type === "CUSTOM" ? recurrence.customDates ?? [] : [],
                    });
                  }}
                >
                  {(Object.keys(RECURRENCE_TYPE_LABELS) as RecurrenceType[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {RECURRENCE_TYPE_LABELS[key]}
                      </option>
                    ),
                  )}
                </Select>
              </div>

              {recurrence.type !== "NONE" &&
                recurrence.type !== "CUSTOM" && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="wiz-until">Repetir hasta</Label>
                      <Input
                        id="wiz-until"
                        type="date"
                        value={recurrence.until}
                        onChange={(e) =>
                          onRecurrenceChange({
                            ...recurrence,
                            until: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wiz-except">Excepciones (fechas ISO, coma)</Label>
                      <Input
                        id="wiz-except"
                        placeholder="2026-12-25, 2027-01-01"
                        value={(recurrence.exceptDates ?? []).join(", ")}
                        onChange={(e) =>
                          onRecurrenceChange({
                            ...recurrence,
                            exceptDates: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                  </>
                )}

              {recurrence.type === "CUSTOM" && (
                <div className="space-y-2">
                  <Label>Fechas personalizadas</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={customDateDraft}
                      onChange={(e) => setCustomDateDraft(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!customDateDraft) return;
                        const set = new Set([
                          ...(recurrence.customDates ?? []),
                          customDateDraft,
                        ]);
                        onRecurrenceChange({
                          ...recurrence,
                          customDates: [...set].sort(),
                        });
                        setCustomDateDraft("");
                      }}
                    >
                      Añadir
                    </Button>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {(recurrence.customDates ?? []).map((d) => (
                      <li key={d} className="flex items-center justify-between gap-2">
                        {formatDateDisplay(new Date(`${d}T12:00:00`))}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onRecurrenceChange({
                              ...recurrence,
                              customDates: (recurrence.customDates ?? []).filter(
                                (x) => x !== d,
                              ),
                            })
                          }
                        >
                          Quitar
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <ContinueButton
                visible={
                  recurrence.type === "NONE" ||
                  (recurrence.type === "CUSTOM" &&
                    (recurrence.customDates?.length ?? 0) > 0) ||
                  (recurrence.type !== "CUSTOM" && Boolean(recurrence.until))
                }
                onClick={() =>
                  setConfirmed((c) => ({ ...c, recurrence: true }))
                }
              />
            </div>
          )}

          {confirmed.recurrence && !confirmed.reminder && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendEventReminder}
                  onChange={(e) => onSendEventReminderChange(e.target.checked)}
                />
                Enviar recordatorio (un día antes)
              </label>
              <ContinueButton
                visible
                onClick={() => {
                  setConfirmed((c) => ({
                    ...c,
                    reminder: true,
                    scheduleCollapsed: true,
                  }));
                }}
              />
            </div>
          )}
        </section>
      )}

      {eventDetailsDone && (
        <p className="rounded-md bg-muted/40 px-3 py-2 text-sm font-medium">
          {eventName.trim()}
        </p>
      )}

      {eventDetailsDone && !confirmed.date && (
        <section className="space-y-2">
          <Label>Fecha</Label>
          <p className="text-base font-semibold">
            {formatDateDisplay(new Date(`${reservationDate}T12:00:00`))}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onReservationDatePick}>
              Cambiar (calendario)
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onSelectionChange({
                  date: reservationDate,
                  startTime,
                  endTime,
                  mapId:
                    selection?.mapId ??
                    restoredSelection?.mapId ??
                    maps[0]?.id ??
                    "",
                  selectedSpaceIds: selection?.selectedSpaceIds ?? [],
                  selectedResources: selection?.selectedResources ?? [],
                });
                setConfirmed((c) => ({ ...c, date: true }));
              }}
            >
              Continuar »
            </Button>
          </div>
        </section>
      )}

      {confirmed.date &&
        needsFourthVsLastPrompt(reservationDate) &&
        recurrence.type === "MONTHLY_RELATIVE" &&
        !relativeDisambiguation && (
          <section className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p>
              En este mes hay 5{" "}
              {weekdayNameEs(new Date(`${reservationDate}T12:00:00`).getDay())}
              s. ¿La repetición será el{" "}
              <strong>cuarto</strong> o el <strong>último</strong> de cada mes?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRelativeDisambiguation("FOURTH")}
              >
                Cuarto{" "}
                {weekdayNameEs(new Date(`${reservationDate}T12:00:00`).getDay())}{" "}
                del mes
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRelativeDisambiguation("LAST")}
              >
                Último{" "}
                {weekdayNameEs(new Date(`${reservationDate}T12:00:00`).getDay())}{" "}
                del mes
              </Button>
            </div>
          </section>
        )}

      {confirmed.date && !confirmed.time && (
        <section className="space-y-2">
          {editingTime ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="wiz-start">Hora inicio</Label>
                <Input
                  id="wiz-start"
                  type="time"
                  value={draftStart}
                  onChange={(e) => {
                    setDraftStart(e.target.value);
                    if (!draftEnd || draftEnd <= e.target.value) {
                      setDraftEnd(addMinutesToTimeHHmm(e.target.value, 60));
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wiz-end">Hora fin</Label>
                <Input
                  id="wiz-end"
                  type="time"
                  value={draftEnd}
                  onChange={(e) => setDraftEnd(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Inicio</Label>
                <p className="font-medium">{startTime}</p>
              </div>
              <div>
                <Label className="text-xs">Fin</Label>
                <p className="font-medium">{endTime}</p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {editingTime ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTime(false)}
                >
                  Listo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onSelectionChange({
                      date: reservationDate,
                      startTime: draftStart,
                      endTime: draftEnd,
                      mapId:
                        selection?.mapId ??
                        restoredSelection?.mapId ??
                        maps[0]?.id ??
                        "",
                      selectedSpaceIds: selection?.selectedSpaceIds ?? [],
                      selectedResources: selection?.selectedResources ?? [],
                    });
                    setEditingTime(false);
                    setConfirmed((c) => ({ ...c, time: true }));
                  }}
                >
                  Continuar »
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTime(true)}
                >
                  Cambiar horario
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setConfirmed((c) => ({ ...c, time: true }))}
                >
                  Continuar »
                </Button>
              </>
            )}
          </div>
        </section>
      )}

      {confirmed.time && (
        <>
          {recurrence.type !== "NONE" && recurrencePreview.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Recurrencia: {recurrencePreview.length} fecha(s) prevista(s)
            </p>
          )}
          <MapDateSelector
            key={`map-${mapSelectorKey}`}
            maps={maps}
            spaces={spaces}
            initialDate={reservationDate}
            initialMapId={initialMapId}
            initialSpaceId={initialSpaceId}
            initialSelection={{
              date: reservationDate,
              startTime,
              endTime,
              mapId: restoredSelection?.mapId ?? initialMapId,
              selectedSpaceIds: selection?.selectedSpaceIds ?? [],
              selectedResources: Object.fromEntries(
                (selection?.selectedResources ?? []).map((r) => [
                  r.resourceId,
                  r.quantity,
                ]),
              ),
            }}
            areas={areas}
            highlightAreaId={activeHighlightAreaId}
            layout="reservation"
            showResourcePanel
            showCalendarLink={false}
            hideScheduleUI
            mapOnly
            emptySpaceLegend="Toca para seleccionar un espacio del mapa"
            resourcesSheetOpen={resourcesOpen}
            onResourcesSheetOpenChange={onResourcesOpenChange}
            onSelectionChange={onSelectionChange}
            estimatedAttendees={estimatedNumber}
            resourcesDisabled={Boolean(
              needsJustification && !attendeeJustificationCode,
            )}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={Boolean(
              needsJustification && !attendeeJustificationCode,
            )}
            onClick={() => onResourcesOpenChange(true)}
          >
            Recursos{resourceCount > 0 ? ` (${resourceCount})` : ""}
          </Button>

          {needsJustification && (
            <section className="space-y-2 rounded-md border border-amber-500/40 p-3">
              <Label>Justificación de asistentes</Label>
              <Select
                value={attendeeJustificationCode}
                onChange={(e) =>
                  onAttendeeJustificationCodeChange(e.target.value)
                }
              >
                <option value="">Selecciona…</option>
                {ATTENDEE_JUSTIFICATION_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              {attendeeJustificationCode === "OTHER" && (
                <Input
                  placeholder="Describe la justificación"
                  value={attendeeJustificationNote}
                  onChange={(e) =>
                    onAttendeeJustificationNoteChange(e.target.value)
                  }
                />
              )}
            </section>
          )}

          <Button
            size="lg"
            className="h-10 w-full"
            disabled={!canSubmit || loading}
            onClick={onSubmit}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Confirmar reserva"
            )}
          </Button>
        </>
      )}
    </div>
  );
}
