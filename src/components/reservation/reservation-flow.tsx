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

interface ReservationFlowProps {
  maps: FloorMap[];
  spaces: Space[];
  areas: Area[];
  isAdmin: boolean;
  userAreaId: string | null;
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
  const [recurrenceType, setRecurrenceType] =
    React.useState<RecurrenceType>("NONE");
  const [recurrenceUntil, setRecurrenceUntil] = React.useState("");
  const [areaId, setAreaId] = React.useState(
    userAreaId ?? areas[0]?.id ?? "",
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resourcesOpen, setResourcesOpen] = React.useState(false);
  const [eventOpen, setEventOpen] = React.useState(false);
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

  const hasValidTimes =
    Boolean(selection?.startTime) && Boolean(selection?.endTime);

  const canSubmit =
    hasValidTimes &&
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

  const resourceCount =
    selection?.selectedResources.filter((item) => item.quantity > 0).length ?? 0;

  return (
    <div className="flex flex-col gap-2 pb-2">
      <MapDateSelector
        maps={maps}
        spaces={spaces}
        initialDate={initialDate}
        initialMapId={initialMapId}
        initialSpaceId={initialSpaceId}
        areas={areas}
        highlightAreaId={isAdmin ? areaId : userAreaId}
        layout="reservation"
        showResourcePanel
        showCalendarLink={false}
        resourcesSheetOpen={resourcesOpen}
        onResourcesSheetOpenChange={setResourcesOpen}
        onSelectionChange={handleSelectionChange}
      />

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
            />
          </div>
        </SheetContent>
      </Sheet>

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

      <Button
        size="lg"
        className="h-10 w-full"
        disabled={!canSubmit || loading}
        onClick={() => submitReservation(false)}
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
                setRecurrenceType("NONE");
                setRecurrenceUntil("");
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
