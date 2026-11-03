"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import type { Area } from "@/types/area";
import type { FloorMap, Space } from "@/types/space";
import type { MapDateSelection, ReservationDetail } from "@/types/reservation";
import {
  extractDateFromIso,
  extractEndTimeForEdit,
  extractTimeFromIso,
} from "@/lib/date-utils";
import { reservationNeedsAttendeeJustification } from "@/lib/capacity-validation";
import { parseRecurrenceRule } from "@/lib/recurrence";
import type { InitialMapSelection } from "@/components/map-date/map-date-selector";
import {
  buildCalendarPickUrl,
  clearReservationDraft,
  consumePickedReservationDate,
  loadReservationDraft,
  saveReservationDraft,
  type ReservationWizardConfirmed,
} from "@/lib/reservation-draft-storage";
import {
  readJsonResponse,
  shouldRetryMutationRequest,
  sleep,
} from "@/lib/read-json-response";
import { ReservationCreateWizard } from "@/components/reservation/reservation-create-wizard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EDIT_WIZARD_CONFIRMED: ReservationWizardConfirmed = {
  area: true,
  eventName: true,
  eventDescription: true,
  attendees: true,
  recurrence: true,
  scheduleCollapsed: true,
  date: true,
  time: true,
};

interface ReservationEditFlowProps {
  reservation: ReservationDetail;
  maps: FloorMap[];
  spaces: Space[];
  areas: Area[];
  isAdmin: boolean;
  userAreaId: string | null;
  userAreaScopeIds: string[];
}

export function ReservationEditFlow({
  reservation,
  maps,
  spaces,
  areas,
  isAdmin,
  userAreaId,
  userAreaScopeIds,
}: ReservationEditFlowProps) {
  const router = useRouter();
  const defaultMapId =
    spaces.find((space) => reservation.spaceIds.includes(space.id))?.mapId ??
    maps[0]?.id ??
    "";

  const initialDate = extractDateFromIso(reservation.startAt);
  const initialStartTime = extractTimeFromIso(reservation.startAt);
  const initialEndTime = extractEndTimeForEdit(
    reservation.startAt,
    reservation.endAt,
  );

  const parsedRecurrence =
    parseRecurrenceRule(reservation.recurrenceRule) ?? {
      type: "NONE" as const,
      until: "",
      exceptDates: [],
      customDates: [],
    };

  const [selection, setSelection] = React.useState<MapDateSelection | null>(
    () => ({
      date: initialDate,
      startTime: initialStartTime,
      endTime: initialEndTime,
      mapId: defaultMapId,
      selectedSpaceIds: reservation.spaceIds,
      selectedResources: reservation.resources.map((r) => ({
        resourceId: r.resourceId,
        quantity: r.quantity,
      })),
    }),
  );
  const [eventName, setEventName] = React.useState(reservation.eventName);
  const [eventDescription, setEventDescription] = React.useState(
    reservation.eventDescription ?? "",
  );
  const [estimatedAttendees, setEstimatedAttendees] = React.useState(
    reservation.estimatedAttendees > 0
      ? String(reservation.estimatedAttendees)
      : "",
  );
  const [attendeeJustificationCode, setAttendeeJustificationCode] =
    React.useState(reservation.attendeeJustificationCode ?? "");
  const [attendeeJustificationNote, setAttendeeJustificationNote] =
    React.useState(reservation.attendeeJustificationNote ?? "");
  const [recurrence, setRecurrence] = React.useState(parsedRecurrence);
  const [sendEventReminder, setSendEventReminder] = React.useState(true);
  const [areaId, setAreaId] = React.useState(reservation.areaId);
  const [reservationAreaId, setReservationAreaId] = React.useState(
    reservation.areaId,
  );
  const [presetsByAreaId, setPresetsByAreaId] = React.useState<
    Record<string, import("@/types/area-event-preset").AreaEventPreset[]>
  >({});
  const [presetSourceAreaId, setPresetSourceAreaId] = React.useState(
    reservation.areaId,
  );
  const [eventDetailsHeaderEl, setEventDetailsHeaderEl] =
    React.useState<HTMLElement | null>(null);
  const [, setEventDetailsDone] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resourcesOpen, setResourcesOpen] = React.useState(false);
  const [similarPrompt, setSimilarPrompt] = React.useState<{
    name: string;
    similarity: number;
  } | null>(null);
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [successPending, setSuccessPending] = React.useState(false);
  const [mapSelectorKey, setMapSelectorKey] = React.useState(0);
  const [restoredSelection, setRestoredSelection] = React.useState<
    InitialMapSelection | undefined
  >({
    date: initialDate,
    startTime: initialStartTime,
    endTime: initialEndTime,
    mapId: defaultMapId,
    selectedSpaceIds: reservation.spaceIds,
    selectedResources: Object.fromEntries(
      reservation.resources.map((r) => [r.resourceId, r.quantity]),
    ),
  });
  const [calendarDateChangeConfirm, setCalendarDateChangeConfirm] =
    React.useState<{ anchorDate: string; newDate: string } | null>(null);

  React.useEffect(() => {
    const scopeQuery = userAreaScopeIds.join(",");
    if (!scopeQuery && !isAdmin) return;
    void fetch(
      `/api/areas/event-presets${scopeQuery ? `?scopeIds=${encodeURIComponent(scopeQuery)}` : ""}`,
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.presetsByAreaId) setPresetsByAreaId(data.presetsByAreaId);
      });
  }, [userAreaScopeIds, isAdmin]);

  React.useEffect(() => {
    const draft = loadReservationDraft();
    if (
      !draft ||
      draft.kind !== "edit" ||
      draft.editReservationId !== reservation.id
    ) {
      return;
    }

    const picked = consumePickedReservationDate();
    setEventName(draft.eventName);
    setEventDescription(draft.eventDescription);
    setEstimatedAttendees(draft.estimatedAttendees);
    setAttendeeJustificationCode(draft.attendeeJustificationCode);
    setAttendeeJustificationNote(draft.attendeeJustificationNote);
    setRecurrence({
      type: draft.recurrenceType,
      until: draft.recurrenceUntil,
      exceptDates: draft.recurrenceExceptDates ?? [],
      customDates: draft.recurrenceCustomDates ?? [],
    });
    setAreaId(draft.areaId);

    const anchorDate =
      draft.calendarAnchorDate ??
      draft.selection?.date ??
      picked ??
      initialDate;

    if (draft.selection) {
      const resolvedDate = picked ?? draft.selection.date;
      setSelection({ ...draft.selection, date: resolvedDate });
      setRestoredSelection({
        date: resolvedDate,
        startTime: draft.selection.startTime,
        endTime: draft.selection.endTime,
        mapId: draft.selection.mapId,
        selectedSpaceIds: draft.selection.selectedSpaceIds,
        selectedResources: Object.fromEntries(
          draft.selection.selectedResources.map((item) => [
            item.resourceId,
            item.quantity,
          ]),
        ),
      });
    } else if (picked) {
      setRestoredSelection((current) =>
        current ? { ...current, date: picked } : { date: picked },
      );
    }

    if (picked) {
      setCalendarDateChangeConfirm({ anchorDate, newDate: picked });
    }

    clearReservationDraft();
    setMapSelectorKey((value) => value + 1);
  }, [initialDate, reservation.id]);

  const handleSelectionChange = React.useCallback(
    (value: MapDateSelection) => {
      setSelection(value);
    },
    [],
  );

  const estimatedNumber = Number(estimatedAttendees);
  const activeSelection = selection ?? {
    date: restoredSelection?.date ?? initialDate,
    startTime: restoredSelection?.startTime ?? initialStartTime,
    endTime: restoredSelection?.endTime ?? initialEndTime,
    mapId: restoredSelection?.mapId ?? defaultMapId,
    selectedSpaceIds:
      restoredSelection?.selectedSpaceIds ?? reservation.spaceIds,
    selectedResources: Object.entries(
      restoredSelection?.selectedResources ?? {},
    ).map(([resourceId, quantity]) => ({ resourceId, quantity })),
  };

  const needsJustification = reservationNeedsAttendeeJustification(
    spaces,
    activeSelection.selectedSpaceIds,
    estimatedNumber,
  );

  const canSubmit =
    Boolean(activeSelection.selectedSpaceIds.length) &&
    eventName.trim().length > 0 &&
    estimatedNumber > 0 &&
    (!needsJustification ||
      (Boolean(attendeeJustificationCode) &&
        (attendeeJustificationCode !== "OTHER" ||
          attendeeJustificationNote.trim().length > 0))) &&
    (isAdmin ? Boolean(areaId) : true);

  async function submitUpdate(confirmSimilarName = false) {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    const payload = {
      eventName: eventName.trim(),
      eventDescription: eventDescription.trim(),
      spaceIds: activeSelection.selectedSpaceIds,
      areaId: isAdmin ? areaId : reservation.areaId,
      date: activeSelection.date,
      startTime: activeSelection.startTime,
      endTime: activeSelection.endTime,
      resources: activeSelection.selectedResources,
      confirmSimilarName,
      estimatedAttendees: estimatedNumber,
      attendeeJustificationCode: needsJustification
        ? attendeeJustificationCode
        : "",
      attendeeJustificationNote:
        needsJustification && attendeeJustificationCode === "OTHER"
          ? attendeeJustificationNote.trim()
          : "",
    };

    try {
      let response!: Response;
      let data!: {
        error?: string;
        similarName?: string;
        similarity?: number;
        pending?: boolean;
      };

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await fetch(`/api/reservas/${reservation.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          data = await readJsonResponse(response);
          break;
        } catch (err) {
          if (attempt === 0 && shouldRetryMutationRequest(response, err)) {
            await sleep(2000);
            continue;
          }
          throw err;
        }
      }

      if (response.status === 409 && data.error === "similar_name") {
        setSimilarPrompt({
          name: data.similarName ?? "",
          similarity: data.similarity ?? 0,
        });
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo actualizar");
      }

      setSimilarPrompt(null);
      setSuccessPending(Boolean(data.pending));
      setSuccessOpen(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  const resourceCount =
    activeSelection.selectedResources.filter((item) => item.quantity > 0)
      .length ?? 0;

  function handleReservationDatePick(ctx: {
    wizardConfirmed: ReservationWizardConfirmed;
  }) {
    saveReservationDraft({
      kind: "edit",
      editReservationId: reservation.id,
      eventName,
      eventDescription,
      estimatedAttendees,
      attendeeJustificationCode,
      attendeeJustificationNote,
      recurrenceType: recurrence.type,
      recurrenceUntil: recurrence.until,
      recurrenceExceptDates: recurrence.exceptDates ?? [],
      recurrenceCustomDates: recurrence.customDates ?? [],
      sendEventReminder,
      areaId,
      reservationAreaId,
      selection: selection ?? {
        date: activeSelection.date,
        startTime: activeSelection.startTime,
        endTime: activeSelection.endTime,
        mapId: activeSelection.mapId,
        selectedSpaceIds: activeSelection.selectedSpaceIds,
        selectedResources: activeSelection.selectedResources,
      },
      wizardConfirmed: ctx.wizardConfirmed,
      calendarAnchorDate: activeSelection.date,
    });
    router.push(
      buildCalendarPickUrl(
        `/reservas/${reservation.id}/editar`,
        activeSelection.date,
      ),
    );
  }

  function handleCalendarDateChangeConfirm(options: {
    newDate: string;
    anchorDate: string;
    keepRecurrence: boolean;
    keepExceptions: boolean;
    exceptDates?: string[];
    recurrence?: typeof recurrence;
  }) {
    const {
      newDate,
      keepRecurrence,
      keepExceptions,
      exceptDates,
      recurrence: nextRecurrence,
    } = options;
    setCalendarDateChangeConfirm(null);

    setRecurrence(() => {
      if (!keepRecurrence || !nextRecurrence) {
        return {
          type: "NONE",
          until: "",
          exceptDates: [],
          customDates: [],
        };
      }
      if (keepExceptions) {
        return {
          ...nextRecurrence,
          exceptDates: exceptDates ?? nextRecurrence.exceptDates ?? [],
        };
      }
      return { ...nextRecurrence, exceptDates: [] };
    });

    setSelection((current) =>
      current ? { ...current, date: newDate } : current,
    );
    setRestoredSelection((current) =>
      current ? { ...current, date: newDate } : { date: newDate },
    );
    setMapSelectorKey((value) => value + 1);
  }

  return (
    <div className="flex flex-col gap-2 pb-2">
      <header ref={setEventDetailsHeaderEl} className="min-h-[2.5rem]" />
      <ReservationCreateWizard
        maps={maps}
        spaces={spaces}
        areas={areas}
        isAdmin={isAdmin}
        userAreaId={userAreaId}
        userAreaScopeIds={userAreaScopeIds}
        initialDate={restoredSelection?.date ?? initialDate}
        mapSelectorKey={mapSelectorKey}
        restoredSelection={restoredSelection}
        initialWizardConfirmed={EDIT_WIZARD_CONFIRMED}
        eventPresetGroups={[]}
        presetsByAreaId={presetsByAreaId}
        presetSourceAreaId={presetSourceAreaId}
        onPresetSourceAreaIdChange={setPresetSourceAreaId}
        onSelectionChange={handleSelectionChange}
        onReservationDatePick={handleReservationDatePick}
        resourcesOpen={resourcesOpen}
        onResourcesOpenChange={setResourcesOpen}
        resourceCount={resourceCount}
        selection={selection}
        onSubmit={() => submitUpdate(false)}
        canSubmit={canSubmit}
        loading={loading}
        eventName={eventName}
        onEventNameChange={setEventName}
        eventDescription={eventDescription}
        onEventDescriptionChange={setEventDescription}
        estimatedAttendees={estimatedAttendees}
        onEstimatedAttendeesChange={setEstimatedAttendees}
        attendeeJustificationCode={attendeeJustificationCode}
        onAttendeeJustificationCodeChange={setAttendeeJustificationCode}
        attendeeJustificationNote={attendeeJustificationNote}
        onAttendeeJustificationNoteChange={setAttendeeJustificationNote}
        recurrence={recurrence}
        onRecurrenceChange={setRecurrence}
        sendEventReminder={sendEventReminder}
        onSendEventReminderChange={setSendEventReminder}
        areaId={areaId}
        onAreaIdChange={setAreaId}
        reservationAreaId={reservationAreaId}
        onReservationAreaIdChange={setReservationAreaId}
        eventDetailsHeaderEl={eventDetailsHeaderEl}
        onEventDetailsDoneChange={setEventDetailsDone}
        calendarDateChangeConfirm={calendarDateChangeConfirm}
        onCalendarDateChangeConfirm={handleCalendarDateChangeConfirm}
        onCalendarDateChangeCancel={() => setCalendarDateChangeConfirm(null)}
        excludeReservationId={reservation.id}
        submitButtonLabel="Guardar cambios"
      />

      {similarPrompt && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="text-base">Nombre similar detectado</CardTitle>
            <CardDescription>
              &ldquo;{similarPrompt.name}&rdquo; es similar (
              {similarPrompt.similarity}%). ¿Deseas continuar?
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => submitUpdate(true)} disabled={loading}>
              Sí, guardar cambios
            </Button>
            <Button variant="outline" onClick={() => setSimilarPrompt(null)}>
              Revisar nombre
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Dialog open={successOpen} onOpenChange={() => undefined}>
        <DialogContent
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              {successPending ? "Solicitud enviada" : "Reserva actualizada"}
            </DialogTitle>
            <DialogDescription>
              {successPending
                ? "Un administrador debe autorizar el cambio."
                : "Los cambios se guardaron correctamente."}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => router.push("/reservas")}>Ver reservas</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
