"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import type { Area } from "@/types/area";
import type { FloorMap, Space } from "@/types/space";
import type { EventPresetGroup } from "@/components/reservation/event-form";
import type { MapDateSelection, RecurrenceConfig } from "@/types/reservation";
import { reservationNeedsAttendeeJustification } from "@/lib/capacity-validation";
import type { InitialMapSelection } from "@/components/map-date/map-date-selector";
import {
  buildCalendarPickUrl,
  clearReservationDraft,
  consumePickedReservationDate,
  loadReservationDraft,
  saveReservationDraft,
  type ReservationWizardConfirmed,
} from "@/lib/reservation-draft-storage";
import { formatDateISO } from "@/lib/date-utils";
import { inferMonthlyRelativeFromDate } from "@/lib/monthly-relative-recurrence";
import { defaultRecurrenceUntil } from "@/lib/recurrence-default-until";
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

interface ReservationFlowProps {
  maps: FloorMap[];
  spaces: Space[];
  areas: Area[];
  isAdmin: boolean;
  userAreaId: string | null;
  userAreaScopeIds: string[];
  initialDate?: string;
  initialMapId?: string;
  initialSpaceId?: string;
}

export function ReservationFlow({
  maps,
  spaces,
  areas,
  isAdmin,
  userAreaId,
  userAreaScopeIds,
  initialDate,
  initialMapId,
  initialSpaceId,
}: ReservationFlowProps) {
  const router = useRouter();
  const [selection, setSelection] = React.useState<MapDateSelection | null>(
    null,
  );
  const [eventName, setEventName] = React.useState("");
  const [eventDescription, setEventDescription] = React.useState("");
  const [estimatedAttendees, setEstimatedAttendees] = React.useState("");
  const [attendeeJustificationCode, setAttendeeJustificationCode] =
    React.useState("");
  const [attendeeJustificationNote, setAttendeeJustificationNote] =
    React.useState("");
  const [recurrence, setRecurrence] = React.useState<RecurrenceConfig>({
    type: "NONE",
    until: "",
    exceptDates: [],
    customDates: [],
  });
  const [sendEventReminder, setSendEventReminder] = React.useState(true);
  const [areaId, setAreaId] = React.useState(
    userAreaId ?? userAreaScopeIds[0] ?? areas[0]?.id ?? "",
  );
  const [reservationAreaId, setReservationAreaId] = React.useState(
    userAreaScopeIds[0] ?? userAreaId ?? "",
  );
  const [eventPresetGroups, setEventPresetGroups] = React.useState<
    EventPresetGroup[]
  >([]);
  const [presetsByAreaId, setPresetsByAreaId] = React.useState<
    Record<string, import("@/types/area-event-preset").AreaEventPreset[]>
  >({});
  const [eventDetailsHeaderEl, setEventDetailsHeaderEl] =
    React.useState<HTMLElement | null>(null);
  const [eventDetailsDone, setEventDetailsDone] = React.useState(false);
  const [presetSourceAreaId, setPresetSourceAreaId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resourcesOpen, setResourcesOpen] = React.useState(false);
  const [similarPrompt, setSimilarPrompt] = React.useState<{
    name: string;
    similarity: number;
  } | null>(null);
  const [successInfo, setSuccessInfo] = React.useState<{
    count: number;
    pending: boolean;
  } | null>(null);
  const [mapSelectorKey, setMapSelectorKey] = React.useState(0);
  const [restoredSelection, setRestoredSelection] = React.useState<
    InitialMapSelection | undefined
  >(undefined);
  const [restoredWizardConfirmed, setRestoredWizardConfirmed] =
    React.useState<ReservationWizardConfirmed | null>(null);
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
        if (data?.groups) setEventPresetGroups(data.groups);
        if (data?.presetsByAreaId) setPresetsByAreaId(data.presetsByAreaId);
      });
  }, [userAreaScopeIds, isAdmin]);

  React.useEffect(() => {
    if (areaId && presetsByAreaId[areaId]?.length) {
      setPresetSourceAreaId(areaId);
    }
  }, [areaId, presetsByAreaId]);

  React.useEffect(() => {
    const draft = loadReservationDraft();
    if (!draft || draft.kind !== "create") return;

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
    setSendEventReminder(draft.sendEventReminder ?? true);
    setAreaId(draft.areaId);
    if (draft.reservationAreaId) {
      setReservationAreaId(draft.reservationAreaId);
    }
    if (draft.wizardConfirmed) {
      setRestoredWizardConfirmed(draft.wizardConfirmed);
    }

    const anchorDate =
      draft.calendarAnchorDate ??
      draft.selection?.date ??
      picked ??
      formatDateISO(new Date());

    if (picked) {
      setCalendarDateChangeConfirm({ anchorDate, newDate: picked });
    }

    if (draft.selection) {
      setSelection({
        ...draft.selection,
        date: picked ? anchorDate : draft.selection.date,
      });
      setRestoredSelection({
        date: picked ? anchorDate : draft.selection.date,
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
      setRestoredSelection({ date: anchorDate });
    }

    clearReservationDraft();
    setMapSelectorKey((value) => value + 1);
  }, []);

  const handleSelectionChange = React.useCallback(
    (value: MapDateSelection) => {
      setSelection(value);
    },
    [],
  );

  const hasValidTimes =
    Boolean(selection?.startTime) && Boolean(selection?.endTime);

  const estimatedNumber = Number(estimatedAttendees);
  const needsJustification =
    selection &&
    reservationNeedsAttendeeJustification(
      spaces,
      selection.selectedSpaceIds,
      estimatedNumber,
    );

  const canSubmit =
    hasValidTimes &&
    Boolean(selection?.selectedSpaceIds.length) &&
    eventName.trim().length > 0 &&
    estimatedNumber > 0 &&
    (!needsJustification ||
      (Boolean(attendeeJustificationCode) &&
        (attendeeJustificationCode !== "OTHER" ||
          attendeeJustificationNote.trim().length > 0))) &&
    (isAdmin
      ? Boolean(areaId)
      : Boolean(
          reservationAreaId || userAreaScopeIds[0] || userAreaId,
        ));

  async function submitReservation(confirmSimilarName = false) {
    if (!selection || !canSubmit) return;

    setLoading(true);
    setError(null);

    const payload = {
      eventName: eventName.trim(),
      eventDescription: eventDescription.trim(),
      spaceIds: selection.selectedSpaceIds,
      areaId: isAdmin
        ? areaId
        : reservationAreaId || userAreaScopeIds[0] || userAreaId,
      date: selection.date,
      startTime: selection.startTime,
      endTime: selection.endTime,
      recurrence: {
        ...recurrence,
        until:
          recurrence.type === "NONE" || recurrence.type === "CUSTOM"
            ? selection.date
            : recurrence.until,
        exceptDates:
          recurrence.type === "NONE" ? [] : recurrence.exceptDates ?? [],
      },
      sendEventReminder,
      resources: selection.selectedResources,
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
        count?: number;
        ids?: string[];
      };

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await fetch("/api/reservas", {
            method: "POST",
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
        const details =
          data.error === "Datos inválidos"
            ? " Revisa asistentes estimados, fecha y espacios seleccionados."
            : "";
        throw new Error((data.error ?? "No se pudo crear la reserva") + details);
      }

      if (!Array.isArray(data.ids) || data.ids.length === 0) {
        throw new Error(
          "No se recibió confirmación del servidor. Revisa Mis reservas antes de volver a intentar.",
        );
      }

      setSimilarPrompt(null);
      setSuccessInfo({
        count: data.count ?? data.ids.length,
        pending: Boolean(data.pending),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reservar");
    } finally {
      setLoading(false);
    }
  }

  const resourceCount =
    selection?.selectedResources.filter((item) => item.quantity > 0).length ?? 0;

  function handleReservationDatePick(ctx: {
    wizardConfirmed: ReservationWizardConfirmed;
  }) {
    saveReservationDraft({
      kind: "create",
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
      selection,
      wizardConfirmed: ctx.wizardConfirmed,
      calendarAnchorDate:
        selection?.date ??
        restoredSelection?.date ??
        initialDate ??
        formatDateISO(new Date()),
    });
    const date =
      selection?.date ??
      restoredSelection?.date ??
      initialDate ??
      formatDateISO(new Date());
    router.push(buildCalendarPickUrl("/reserva", date));
  }

  function handleCalendarDateChangeConfirm(options: {
    newDate: string;
    keepRecurrence: boolean;
    keepExceptions: boolean;
  }) {
    const { newDate, keepRecurrence, keepExceptions } = options;
    setCalendarDateChangeConfirm(null);

    setRecurrence((current) => {
      if (!keepRecurrence) {
        return {
          type: "NONE",
          until: "",
          exceptDates: [],
          customDates: [],
        };
      }
      let next = { ...current };
      if (!keepExceptions) {
        next = { ...next, exceptDates: [] };
      }
      if (next.type === "MONTHLY_RELATIVE") {
        const inferred = inferMonthlyRelativeFromDate(newDate);
        next = {
          ...next,
          monthlyRelative: {
            weekday: inferred.weekday,
            ordinal: inferred.ordinal,
          },
          until:
            next.until?.trim() && next.until >= newDate
              ? next.until
              : defaultRecurrenceUntil(newDate, "MONTHLY_RELATIVE"),
        };
      }
      return next;
    });

    setSelection((current) =>
      current ? { ...current, date: newDate } : current,
    );
    setRestoredSelection((current) =>
      current ? { ...current, date: newDate } : { date: newDate },
    );
    setMapSelectorKey((value) => value + 1);
  }

  function handleCalendarDateChangeCancel() {
    setCalendarDateChangeConfirm(null);
  }

  return (
    <div className="flex flex-col gap-2 pb-2">
      <header ref={setEventDetailsHeaderEl} className="min-h-[2.5rem]">
        {!eventDetailsDone && (
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Nueva reserva
          </h1>
        )}
      </header>
      <ReservationCreateWizard
        maps={maps}
        spaces={spaces}
        areas={areas}
        isAdmin={isAdmin}
        userAreaId={userAreaId}
        userAreaScopeIds={userAreaScopeIds}
        initialDate={restoredSelection?.date ?? initialDate}
        initialMapId={initialMapId}
        initialSpaceId={initialSpaceId}
        mapSelectorKey={mapSelectorKey}
        restoredSelection={restoredSelection}
        initialWizardConfirmed={restoredWizardConfirmed}
        eventPresetGroups={eventPresetGroups}
        presetsByAreaId={presetsByAreaId}
        presetSourceAreaId={presetSourceAreaId}
        onPresetSourceAreaIdChange={setPresetSourceAreaId}
        onSelectionChange={handleSelectionChange}
        onReservationDatePick={handleReservationDatePick}
        resourcesOpen={resourcesOpen}
        onResourcesOpenChange={setResourcesOpen}
        resourceCount={resourceCount}
        selection={selection}
        onSubmit={() => submitReservation(false)}
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
        onCalendarDateChangeCancel={handleCalendarDateChangeCancel}
      />

      {similarPrompt && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="text-base">Nombre similar detectado</CardTitle>
            <CardDescription>
              &ldquo;{similarPrompt.name}&rdquo; es similar al nombre ingresado (
              {similarPrompt.similarity}% coincidencia). ¿Deseas continuar?
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              onClick={() => submitReservation(true)}
              disabled={loading}
            >
              Sí, usar este nombre
            </Button>
            <Button
              variant="outline"
              onClick={() => setSimilarPrompt(null)}
              disabled={loading}
            >
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

      <Dialog
        open={successInfo !== null}
        onOpenChange={() => {
          /* Sin cierre por overlay ni Escape */
        }}
      >
        <DialogContent
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400 sm:justify-start">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              {successInfo?.pending ? "Solicitud enviada" : "Reserva confirmada"}
            </DialogTitle>
            <DialogDescription className="text-left">
              {successInfo?.pending
                ? `Se envió la solicitud de ${successInfo.count === 1 ? "1 reserva" : `${successInfo.count} reservas`} para autorización del administrador.`
                : `Se ${successInfo?.count === 1 ? "creó 1 reserva" : `crearon ${successInfo?.count ?? 0} reservas`} correctamente.`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              onClick={() => router.push("/reservas")}
            >
              Ver mis reservas
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setSuccessInfo(null);
                setEventName("");
                setEventDescription("");
                setEstimatedAttendees("");
                setAttendeeJustificationCode("");
                setAttendeeJustificationNote("");
                setRecurrence({
                  type: "NONE",
                  until: "",
                  exceptDates: [],
                  customDates: [],
                });
                setSendEventReminder(true);
              }}
            >
              Crear otra reserva
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
