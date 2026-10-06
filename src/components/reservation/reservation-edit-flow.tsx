"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import type { Area } from "@/types/area";
import type { FloorMap, Space } from "@/types/space";
import type {
  MapDateSelection,
  ReservationDetail,
} from "@/types/reservation";
import {
  extractDateFromIso,
  extractEndTimeForEdit,
  extractTimeFromIso,
} from "@/lib/date-utils";
import { MapDateSelector } from "@/components/map-date/map-date-selector";
import { EventForm } from "@/components/reservation/event-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

  const [selection, setSelection] = React.useState<MapDateSelection | null>(
    null,
  );
  const [eventName, setEventName] = React.useState(reservation.eventName);
  const [eventDescription, setEventDescription] = React.useState(
    reservation.eventDescription ?? "",
  );
  const [areaId, setAreaId] = React.useState(reservation.areaId);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [savedPending, setSavedPending] = React.useState(false);
  const [similarPrompt, setSimilarPrompt] = React.useState<{
    name: string;
    similarity: number;
  } | null>(null);

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

  const handleSelectionChange = React.useCallback(
    (value: MapDateSelection) => {
      setSelection(value);
    },
    [],
  );

  async function submitUpdate(confirmSimilarName = false) {
    if (!selection || !selection.selectedSpaceIds.length) {
      setError("Selecciona al menos un espacio.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reservas/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: eventName.trim(),
          eventDescription: eventDescription.trim(),
          spaceIds: selection.selectedSpaceIds,
          areaId: isAdmin ? areaId : reservation.areaId,
          date: selection.date,
          startTime: selection.startTime,
          endTime: selection.endTime,
          resources: selection.selectedResources,
          confirmSimilarName,
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
      setSaved(true);
      setSavedPending(Boolean(data.pending));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  if (saved) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            {savedPending ? "Solicitud enviada" : "Reserva actualizada"}
          </CardTitle>
          <CardDescription>
            {savedPending
              ? "Los cambios quedaron pendientes de autorización del administrador."
              : "Los cambios se guardaron correctamente en Google Sheets."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={() => router.push("/reservas")}>
            Volver al listado
          </Button>
          <Button variant="outline" onClick={() => setSaved(false)}>
            Seguir editando
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/reservas">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver a mis reservas
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Modificar reserva</CardTitle>
          <CardDescription>
            Actualiza espacios, horario, recursos y nombre del evento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MapDateSelector
            key={`${reservation.id}-${initialStartTime}-${initialEndTime}-${initialDate}`}
            maps={maps}
            spaces={spaces}
            showResourcePanel
            showCalendarLink={false}
            excludeReservationId={reservation.id}
            initialSelection={initialMapSelection}
            onSelectionChange={handleSelectionChange}
          />
        </CardContent>
      </Card>

      <EventForm
        eventName={eventName}
        onEventNameChange={setEventName}
        eventDescription={eventDescription}
        onEventDescriptionChange={setEventDescription}
        recurrenceType="NONE"
        onRecurrenceTypeChange={() => undefined}
        recurrenceUntil=""
        onRecurrenceUntilChange={() => undefined}
        baseDate={selection?.date ?? extractDateFromIso(reservation.startAt)}
        areaId={areaId}
        onAreaIdChange={setAreaId}
        areas={areas}
        isAdmin={isAdmin}
        hideRecurrence
      />

      {reservation.recurrenceRule && (
        <p className="text-sm text-muted-foreground">
          Esta reserva pertenece a una serie recurrente. Al modificar, solo se
          actualiza esta ocurrencia.
        </p>
      )}

      {similarPrompt && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="text-base">Nombre similar detectado</CardTitle>
            <CardDescription>
              "{similarPrompt.name}" es similar ({similarPrompt.similarity}%).
              ¿Deseas continuar?
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
        disabled={loading}
        onClick={() => submitUpdate(false)}
        className="gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          "Guardar cambios"
        )}
      </Button>
    </div>
  );
}
