"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { Area } from "@/types/area";
import type { FloorMap, Space } from "@/types/space";
import type { MapDateSelection, ReservationDetail } from "@/types/reservation";
import {
  extractDateFromIso,
  extractEndTimeForEdit,
  extractTimeFromIso,
} from "@/lib/date-utils";
import { reservationNeedsAttendeeJustification } from "@/lib/capacity-validation";
import {
  MapDateSelector,
  type InitialMapSelection,
} from "@/components/map-date/map-date-selector";
import {
  buildCalendarPickUrl,
  clearReservationDraft,
  consumePickedReservationDate,
  loadReservationDraft,
  saveReservationDraft,
} from "@/lib/reservation-draft-storage";
import { EventForm } from "@/components/reservation/event-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ReservationEditFlowProps {
  reservation: ReservationDetail;
  maps: FloorMap[];
  spaces: Space[];
  areas: Area[];
  isAdmin: boolean;
}

export function ReservationEditFlow({
  reservation,
  maps,
  spaces,
  areas,
  isAdmin,
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

  const initialMapSelection = React.useMemo(
    () => ({
      date: initialDate,
      startTime: initialStartTime,
      endTime: initialEndTime,
      mapId: defaultMapId,
      selectedSpaceIds: reservation.spaceIds,
      selectedResources: Object.fromEntries(
        reservation.resources.map((resource) => [
          resource.resourceId,
          resource.quantity,
        ]),
      ),
    }),
    [
      defaultMapId,
      initialDate,
      initialEndTime,
      initialStartTime,
      reservation.resources,
      reservation.spaceIds,
    ],
  );

  const [selection, setSelection] = React.useState<MapDateSelection | null>(
    null,
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
  const [areaId, setAreaId] = React.useState(reservation.areaId);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resourcesOpen, setResourcesOpen] = React.useState(false);
  const [eventOpen, setEventOpen] = React.useState(false);
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [successPending, setSuccessPending] = React.useState(false);
  const [similarPrompt, setSimilarPrompt] = React.useState<{
    name: string;
    similarity: number;
  } | null>(null);
  const [mapSelectorKey, setMapSelectorKey] = React.useState(0);
  const [restoredSelection, setRestoredSelection] = React.useState<
    InitialMapSelection | undefined
  >(undefined);

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
    setAreaId(draft.areaId);

    if (draft.selection) {
      setSelection(draft.selection);
      setRestoredSelection({
        date: picked ?? draft.selection.date,
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
      setRestoredSelection({
        ...initialMapSelection,
        date: picked,
      });
    }

    clearReservationDraft();
    setMapSelectorKey((value) => value + 1);
  }, [initialMapSelection, reservation.id]);

  const handleSelectionChange = React.useCallback(
    (value: MapDateSelection) => {
      setSelection(value);
    },
    [],
  );

  const activeSelection = selection ?? {
    date: initialDate,
    startTime: initialStartTime,
    endTime: initialEndTime,
    mapId: defaultMapId,
    selectedSpaceIds: reservation.spaceIds,
    selectedResources: reservation.resources.map((r) => ({
      resourceId: r.resourceId,
      quantity: r.quantity,
    })),
  };

  const estimatedNumber = Number(estimatedAttendees);
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
    (!isAdmin || Boolean(areaId));

  async function submitUpdate(confirmSimilarName = false) {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reservas/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      const data = await response.json();

      if (response.status === 409 && data.error === "similar_name") {
        setSimilarPrompt({
          name: data.similarName,
          similarity: data.similarity,
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

  const mapInitialSelection = restoredSelection ?? initialMapSelection;

  function handleReservationDatePick() {
    saveReservationDraft({
      kind: "edit",
      editReservationId: reservation.id,
      eventName,
      eventDescription,
      estimatedAttendees,
      attendeeJustificationCode,
      attendeeJustificationNote,
      recurrenceType: "NONE",
      recurrenceUntil: "",
      areaId,
      selection: selection ?? {
        date: mapInitialSelection.date ?? initialDate,
        startTime: mapInitialSelection.startTime ?? initialStartTime,
        endTime: mapInitialSelection.endTime ?? initialEndTime,
        mapId: mapInitialSelection.mapId ?? defaultMapId,
        selectedSpaceIds: mapInitialSelection.selectedSpaceIds ?? [],
        selectedResources: Object.entries(
          mapInitialSelection.selectedResources ?? {},
        ).map(([resourceId, quantity]) => ({ resourceId, quantity })),
      },
    });
    router.push(
      buildCalendarPickUrl(
        `/reservas/${reservation.id}/editar`,
        selection?.date ?? mapInitialSelection.date ?? initialDate,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-2">
      <MapDateSelector
        key={`${reservation.id}-${mapSelectorKey}`}
        maps={maps}
        spaces={spaces}
        layout="reservation"
        showResourcePanel
        showCalendarLink={false}
        excludeReservationId={reservation.id}
        initialSelection={mapInitialSelection}
        areas={areas}
        highlightAreaId={isAdmin ? areaId : reservation.areaId}
        resourcesSheetOpen={resourcesOpen}
        onResourcesSheetOpenChange={setResourcesOpen}
        onSelectionChange={handleSelectionChange}
        onReservationDatePick={handleReservationDatePick}
      />

      {isAdmin && (
        <div className="space-y-1 pt-1">
          <Label htmlFor="editReservationAreaId" className="text-xs">
            Área
          </Label>
          <Select
            id="editReservationAreaId"
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
            className="h-9"
          >
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => setResourcesOpen(true)}
        >
          Recursos{resourceCount > 0 ? ` (${resourceCount})` : ""}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => setEventOpen(true)}
        >
          Datos del evento
        </Button>
      </div>

      <Sheet open={eventOpen} onOpenChange={setEventOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto px-4 pb-8 pt-4"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Datos del evento</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <EventForm
              bare
              hideRecurrence
              eventName={eventName}
              onEventNameChange={setEventName}
              eventDescription={eventDescription}
              onEventDescriptionChange={setEventDescription}
              recurrenceType="NONE"
              onRecurrenceTypeChange={() => undefined}
              recurrenceUntil=""
              onRecurrenceUntilChange={() => undefined}
              baseDate={activeSelection.date}
              areaId={areaId}
              onAreaIdChange={setAreaId}
              areas={areas}
              isAdmin={isAdmin}
              hideAdminArea
              estimatedAttendees={estimatedAttendees}
              onEstimatedAttendeesChange={setEstimatedAttendees}
              attendeeJustificationCode={attendeeJustificationCode}
              onAttendeeJustificationCodeChange={setAttendeeJustificationCode}
              attendeeJustificationNote={attendeeJustificationNote}
              onAttendeeJustificationNoteChange={setAttendeeJustificationNote}
              selectedSpaceIds={activeSelection.selectedSpaceIds}
              spaces={spaces}
            />
          </div>
        </SheetContent>
      </Sheet>

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

      <Button
        size="lg"
        className="h-10 w-full"
        disabled={!canSubmit || loading}
        onClick={() => submitUpdate(false)}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          "Guardar cambios"
        )}
      </Button>

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
                ? "Los cambios quedaron pendientes de autorización."
                : "Los cambios se guardaron correctamente."}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => router.push("/reservas")}>
            Volver a mis reservas
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
