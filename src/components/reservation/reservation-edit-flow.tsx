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
  clearAllReservationDraftState,
  finalizeReservationDraftRestore,
  markCalendarPickPending,
  peekEditFlowRestoreSnapshot,
  saveReservationDraft,
  type ReservationWizardConfirmed,
} from "@/lib/reservation-draft-storage";
import { releaseRadixBodyScrollLockIfIdle } from "@/lib/radix-body-lock";
import { readJsonResponse } from "@/lib/read-json-response";
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
  const submitInFlightRef = React.useRef(false);
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

  const [restoreSnapshot] = React.useState(() =>
    peekEditFlowRestoreSnapshot(reservation.id),
  );

  React.useEffect(() => {
    const snapshot = restoreSnapshot;
    if (!snapshot) {
      clearAllReservationDraftState();
      return;
    }

    const picked = snapshot.pickedDate;
    const draft = snapshot.draft;

    if (!draft) {
      if (picked) {
        setRestoredSelection((current) =>
          current ? { ...current, date: picked } : { date: picked },
        );
        setCalendarDateChangeConfirm({
          anchorDate: initialDate,
          newDate: picked,
        });
        setMapSelectorKey((value) => value + 1);
      }
      finalizeReservationDraftRestore();
      return;
    }

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

    const resolvedDate = picked ?? draft.selection?.date ?? anchorDate;
    const startTime =
      draft.selection?.startTime ??
      draft.wizardDraftStart ??
      initialStartTime;
    const endTime =
      draft.selection?.endTime ?? draft.wizardDraftEnd ?? initialEndTime;
    const mapId = draft.selection?.mapId ?? defaultMapId;
    const selectedSpaceIds =
      draft.selection?.selectedSpaceIds ?? reservation.spaceIds;
    const selectedResources = draft.selection?.selectedResources ?? [];

    setSelection({
      date: resolvedDate,
      startTime,
      endTime,
      mapId,
      selectedSpaceIds,
      selectedResources,
    });
    setRestoredSelection({
      date: resolvedDate,
      startTime,
      endTime,
      mapId,
      selectedSpaceIds,
      selectedResources: Object.fromEntries(
        selectedResources.map((item) => [item.resourceId, item.quantity]),
      ),
    });

    if (picked) {
      setCalendarDateChangeConfirm({ anchorDate, newDate: picked });
    }

    finalizeReservationDraftRestore();
    setMapSelectorKey((value) => value + 1);
  }, [restoreSnapshot, initialDate, reservation.id, reservation.spaceIds, defaultMapId, initialStartTime, initialEndTime]);

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
    if (!canSubmit || submitInFlightRef.current) return;

    submitInFlightRef.current = true;
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
      const response = await fetch(`/api/reservas/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJsonResponse<{
        error?: string;
        similarName?: string;
        similarity?: number;
        pending?: boolean;
      }>(response);

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
      submitInFlightRef.current = false;
      setLoading(false);
    }
  }

  const resourceCount =
    activeSelection.selectedResources.filter((item) => item.quantity > 0)
      .length ?? 0;

  function handleReservationDatePick(ctx: {
    wizardConfirmed: ReservationWizardConfirmed;
    wizardDraftStart?: string;
    wizardDraftEnd?: string;
  }) {
    const baseSelection = selection ?? {
      date: activeSelection.date,
      startTime: ctx.wizardDraftStart ?? activeSelection.startTime,
      endTime: ctx.wizardDraftEnd ?? activeSelection.endTime,
      mapId: activeSelection.mapId,
      selectedSpaceIds: activeSelection.selectedSpaceIds,
      selectedResources: activeSelection.selectedResources,
    };

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
      selection: baseSelection,
      wizardConfirmed: ctx.wizardConfirmed,
      wizardDraftStart: ctx.wizardDraftStart,
      wizardDraftEnd: ctx.wizardDraftEnd,
      calendarAnchorDate: activeSelection.date,
    });
    markCalendarPickPending();
  }

  const calendarPickHref = buildCalendarPickUrl(
    `/reservas/${reservation.id}/editar`,
    activeSelection.date,
  );

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
        calendarPickHref={calendarPickHref}
        onReservationDatePick={handleReservationDatePick}
        resourcesOpen={resourcesOpen}
        onResourcesOpenChange={(open) => {
          setResourcesOpen(open);
          if (!open) {
            window.requestAnimationFrame(() => releaseRadixBodyScrollLockIfIdle());
          }
        }}
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
