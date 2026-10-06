"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, Pencil, Trash2 } from "lucide-react";
import { formatReservationDateTimeRange } from "@/lib/date-utils";
import type { ReservationDetail } from "@/types/reservation";
import { reservationNeedsAdminAction } from "@/types/reservation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ReservationsListProps {
  initialReservations: ReservationDetail[];
  isAdmin: boolean;
}

function statusLabel(reservation: ReservationDetail): string {
  if (reservation.status === "PENDING") return "Pendiente de autorización";
  if (reservation.pendingAction === "UPDATE") return "Cambio pendiente";
  if (reservation.pendingAction === "CANCEL") return "Cancelación pendiente";
  if (reservation.status === "CONFIRMED") return "Confirmada";
  if (reservation.status === "CANCELLED") return "Cancelada";
  return reservation.status;
}

function statusVariant(
  reservation: ReservationDetail,
): "default" | "secondary" | "outline" {
  if (reservationNeedsAdminAction(reservation)) return "outline";
  if (reservation.status === "CONFIRMED") return "secondary";
  return "default";
}

export function ReservationsList({
  initialReservations,
  isAdmin,
}: ReservationsListProps) {
  const router = useRouter();
  const [reservations, setReservations] =
    React.useState(initialReservations);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function refreshList() {
    const response = await fetch("/api/reservas");
    if (response.ok) {
      setReservations(await response.json());
    }
  }

  async function handleCancel(id: string, eventName: string) {
    if (
      !confirm(
        `¿Cancelar la reserva "${eventName}"? Se liberarán espacios y recursos.`,
      )
    ) {
      return;
    }

    setLoadingId(id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/reservas/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo cancelar");
      }
      if (data.pending) {
        setSuccess(
          "La cancelación fue enviada y queda pendiente de autorización por un administrador.",
        );
      }
      await refreshList();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cancelar");
    } finally {
      setLoadingId(null);
    }
  }

  if (reservations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">No hay reservas activas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? "Aún no se han registrado reservas en el sistema."
                : "Tu área no tiene reservas activas por ahora."}
            </p>
          </div>
          <Button asChild>
            <Link href="/reserva">Crear reserva</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {success}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {reservations.map((reservation) => (
          <Card key={reservation.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-lg">
                    {reservation.eventName}
                  </CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">
                    {formatReservationDateTimeRange(
                      reservation.startAt,
                      reservation.endAt,
                    )}
                  </CardDescription>
                </div>
                <Badge variant={statusVariant(reservation)}>
                  {statusLabel(reservation)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {reservation.eventDescription && (
                <p className="text-sm text-muted-foreground">
                  {reservation.eventDescription}
                </p>
              )}
              {reservationNeedsAdminAction(reservation) && (
                <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                  {reservation.status === "PENDING"
                    ? "Esta reserva espera autorización de un administrador."
                    : reservation.pendingAction === "UPDATE"
                      ? "Los cambios solicitados esperan autorización."
                      : "La cancelación solicitada espera autorización."}
                </p>
              )}
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">
                  <span className="font-normal text-muted-foreground">
                    Fecha y horario:{" "}
                  </span>
                  {formatReservationDateTimeRange(
                    reservation.startAt,
                    reservation.endAt,
                  )}
                </p>
                <p>
                  <span className="text-muted-foreground">Espacios: </span>
                  {reservation.spaceNames.join(", ") || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Recursos: </span>
                  {reservation.resources.length > 0
                    ? reservation.resources
                        .map((r) => `${r.resourceName} ×${r.quantity}`)
                        .join(", ")
                    : "Ninguno"}
                </p>
                {isAdmin && (
                  <p>
                    <span className="text-muted-foreground">Área: </span>
                    {reservation.areaName ?? reservation.areaId ?? "—"}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/reservas/${reservation.id}/editar`}>
                    <Pencil className="mr-1 h-4 w-4" />
                    Modificar
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={loadingId === reservation.id}
                  onClick={() =>
                    handleCancel(reservation.id, reservation.eventName)
                  }
                >
                  {loadingId === reservation.id ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-4 w-4" />
                  )}
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
