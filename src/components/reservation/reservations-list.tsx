"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  formatReservationDateTimeRange,
  formatTimeDisplay,
} from "@/lib/date-utils";
import type { ReservationDetail } from "@/types/reservation";
import type { SessionUser } from "@/types/user";
import { reservationNeedsAdminAction } from "@/types/reservation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  canCancelReservation,
  canConfirmAttendance,
  canModifyReservation,
} from "@/lib/auth/reservation-permissions";
import { isPastReservation } from "@/lib/reservation-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { readJsonResponse } from "@/lib/read-json-response";
import { cn } from "@/lib/utils";

interface ReservationsListProps {
  initialReservations: ReservationDetail[];
  isAdmin: boolean;
  viewerUser: SessionUser | null;
}

type ListFilter = "upcoming" | "past";

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

function summaryDateTime(reservation: ReservationDetail): string {
  const start = new Date(reservation.startAt);
  const end = new Date(reservation.endAt);
  const datePart = start.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${datePart} · ${formatTimeDisplay(start)}–${formatTimeDisplay(end)}`;
}

export function ReservationsList({
  initialReservations,
  isAdmin,
  viewerUser,
}: ReservationsListProps) {
  const router = useRouter();
  const [reservations, setReservations] =
    React.useState(initialReservations);
  const [listFilter, setListFilter] = React.useState<ListFilter>("upcoming");
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<{
    id: string;
    eventName: string;
  } | null>(null);

  const filtered = React.useMemo(() => {
    const list = reservations.filter((reservation) =>
      listFilter === "past"
        ? isPastReservation(reservation)
        : !isPastReservation(reservation),
    );
    return list.sort((a, b) => {
      const diff =
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      return listFilter === "past" ? -diff : diff;
    });
  }, [reservations, listFilter]);

  async function refreshList() {
    const response = await fetch("/api/reservas");
    if (response.ok) {
      setReservations(await response.json());
    }
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function requestCancel(id: string, eventName: string) {
    setCancelTarget({ id, eventName });
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    const { id } = cancelTarget;

    setLoadingId(id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/reservas/${id}`, {
        method: "DELETE",
      });
      const data = await readJsonResponse<{ error?: string; pending?: boolean }>(
        response,
      );
      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo cancelar");
      }
      if (data.pending) {
        setSuccess(
          "La cancelación fue enviada y queda pendiente de autorización por un administrador.",
        );
      }
      setCancelTarget(null);
      await refreshList();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cancelar");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-lg border border-border p-0.5 text-xs sm:text-sm"
          role="group"
          aria-label="Filtrar reservas por periodo"
        >
          <button
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1.5 font-medium transition-colors sm:px-3",
              listFilter === "upcoming"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setListFilter("upcoming")}
          >
            Actuales y futuras
          </button>
          <button
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1.5 font-medium transition-colors sm:px-3",
              listFilter === "past"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setListFilter("past")}
          >
            Pasadas
          </button>
        </div>
      </div>

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

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {listFilter === "past"
                  ? "No hay reservas pasadas"
                  : "No hay reservas actuales o futuras"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {listFilter === "past"
                  ? "Las reservas anteriores aparecerán aquí."
                  : isAdmin
                    ? "Aún no hay reservas en este periodo."
                    : "Tu área no tiene reservas en este periodo."}
              </p>
            </div>
            {listFilter === "upcoming" && (
              <Button asChild>
                <Link href="/reserva">Crear reserva</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 md:gap-3">
          {filtered.map((reservation) => {
            const expanded = expandedIds.has(reservation.id);
            return (
              <Card key={reservation.id} className="overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-muted/40 sm:px-4"
                  onClick={() => toggleExpanded(reservation.id)}
                  aria-expanded={expanded}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold sm:text-base">
                      {reservation.eventName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground sm:text-sm">
                      {summaryDateTime(reservation)}
                    </p>
                  </div>
                  <Badge
                    variant={statusVariant(reservation)}
                    className="shrink-0 text-[10px] sm:text-xs"
                  >
                    {statusLabel(reservation)}
                  </Badge>
                </button>

                {expanded && (
                  <CardContent className="space-y-4 border-t border-border pt-4">
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
                      {reservation.estimatedAttendees > 0 && (
                        <p>
                          <span className="text-muted-foreground">
                            Asistentes estimados:{" "}
                          </span>
                          {reservation.estimatedAttendees}
                        </p>
                      )}
                      {reservation.actualAttendees != null && (
                        <p>
                          <span className="text-muted-foreground">
                            Asistentes registrados:{" "}
                          </span>
                          {reservation.actualAttendees}
                        </p>
                      )}
                      {isAdmin && (
                        <p>
                          <span className="text-muted-foreground">Área: </span>
                          {reservation.areaName ?? reservation.areaId ?? "—"}
                        </p>
                      )}
                    </div>

                    <div
                      className="flex flex-wrap gap-2"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {canConfirmAttendance(viewerUser, reservation) &&
                        isPastReservation(reservation) &&
                        !isAdmin && (
                          <Button asChild size="sm" variant="default">
                            <Link href={`/reservas/${reservation.id}/editar`}>
                              Registrar asistencia
                            </Link>
                          </Button>
                        )}
                      {canModifyReservation(viewerUser, reservation) && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/reservas/${reservation.id}/editar`}>
                            <Pencil className="mr-1 h-4 w-4" />
                            Modificar
                          </Link>
                        </Button>
                      )}
                      {canCancelReservation(viewerUser, reservation) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={loadingId === reservation.id}
                          onClick={() =>
                            requestCancel(
                              reservation.id,
                              reservation.eventName,
                            )
                          }
                        >
                          {loadingId === reservation.id ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-1 h-4 w-4" />
                          )}
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar reserva</DialogTitle>
            <DialogDescription>
              {cancelTarget
                ? `¿Cancelar la reserva «${cancelTarget.eventName}»? Se liberarán espacios y recursos.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setCancelTarget(null)}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              disabled={Boolean(loadingId)}
              onClick={confirmCancel}
            >
              {loadingId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirmar cancelación"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
