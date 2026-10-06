"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { Area } from "@/types/area";
import type { FloorMap, Space } from "@/types/space";
import type { MapDateSelection, RecurrenceType } from "@/types/reservation";
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

interface ReservationFlowProps {
  maps: FloorMap[];
  spaces: Space[];
  areas: Area[];
  isAdmin: boolean;
  userAreaId: string | null;
  initialDate?: string;
}

export function ReservationFlow({
  maps,
  spaces,
  areas,
  isAdmin,
  userAreaId,
  initialDate,
}: ReservationFlowProps) {
  const router = useRouter();
  const [selection, setSelection] = React.useState<MapDateSelection | null>(
    null,
  );
  const [eventName, setEventName] = React.useState("");
  const [eventDescription, setEventDescription] = React.useState("");
  const [recurrenceType, setRecurrenceType] =
    React.useState<RecurrenceType>("NONE");
  const [recurrenceUntil, setRecurrenceUntil] = React.useState("");
  const [areaId, setAreaId] = React.useState(
    userAreaId ?? areas[0]?.id ?? "",
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [similarPrompt, setSimilarPrompt] = React.useState<{
    name: string;
    similarity: number;
  } | null>(null);
  const [successInfo, setSuccessInfo] = React.useState<{
    count: number;
    pending: boolean;
  } | null>(null);

  const handleSelectionChange = React.useCallback(
    (value: MapDateSelection) => {
      setSelection(value);
    },
    [],
  );

  const canSubmit =
    Boolean(selection?.selectedSpaceIds.length) &&
    eventName.trim().length > 0 &&
    (!isAdmin || Boolean(areaId));

  async function submitReservation(confirmSimilarName = false) {
    if (!selection || !canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: eventName.trim(),
          eventDescription: eventDescription.trim(),
          spaceIds: selection.selectedSpaceIds,
          areaId: isAdmin ? areaId : userAreaId,
          date: selection.date,
          startTime: selection.startTime,
          endTime: selection.endTime,
          recurrence: {
            type: recurrenceType,
            until: recurrenceType === "NONE" ? selection.date : recurrenceUntil,
          },
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
        throw new Error(data.error ?? "No se pudo crear la reserva");
      }

      setSimilarPrompt(null);
      setSuccessInfo({
        count: data.count ?? 1,
        pending: Boolean(data.pending),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reservar");
    } finally {
      setLoading(false);
    }
  }

  if (successInfo !== null) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            {successInfo.pending ? "Solicitud enviada" : "Reserva confirmada"}
          </CardTitle>
          <CardDescription>
            {successInfo.pending
              ? `Se envió la solicitud de ${successInfo.count === 1 ? "1 reserva" : `${successInfo.count} reservas`} para autorización del administrador.`
              : `Se ${successInfo.count === 1 ? "creó 1 reserva" : `crearon ${successInfo.count} reservas`} correctamente.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => router.push("/reservas")}>
            Ver mis reservas
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSuccessInfo(null);
              setEventName("");
              setEventDescription("");
              setRecurrenceType("NONE");
              setRecurrenceUntil("");
            }}
          >
            Crear otra reserva
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Paso 1–3: Espacios, periodo y recursos</CardTitle>
          <CardDescription>
            Selecciona fecha, horario, espacios en el mapa y recursos necesarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MapDateSelector
            maps={maps}
            spaces={spaces}
            initialDate={initialDate}
            showResourcePanel
            showCalendarLink
            onSelectionChange={handleSelectionChange}
          />
        </CardContent>
      </Card>

      <EventForm
        eventName={eventName}
        onEventNameChange={setEventName}
        eventDescription={eventDescription}
        onEventDescriptionChange={setEventDescription}
        recurrenceType={recurrenceType}
        onRecurrenceTypeChange={setRecurrenceType}
        recurrenceUntil={recurrenceUntil}
        onRecurrenceUntilChange={setRecurrenceUntil}
        baseDate={selection?.date ?? ""}
        areaId={areaId}
        onAreaIdChange={setAreaId}
        areas={areas}
        isAdmin={isAdmin}
        disabled={!selection?.selectedSpaceIds.length}
      />

      {similarPrompt && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="text-base">Nombre similar detectado</CardTitle>
            <CardDescription>
              "{similarPrompt.name}" es similar al nombre ingresado (
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {!selection?.selectedSpaceIds.length
            ? "Selecciona al menos un espacio en el mapa para continuar."
            : "Revisa los datos y confirma la reserva."}
        </p>
        <Button
          size="lg"
          disabled={!canSubmit || loading}
          onClick={() => submitReservation(false)}
          className="gap-2 sm:min-w-[180px]"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            "Confirmar reserva"
          )}
        </Button>
      </div>
    </div>
  );
}
