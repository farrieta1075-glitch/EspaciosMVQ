"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ReservationDetail } from "@/types/reservation";
import { areaCardStyle, getAreaColor } from "@/lib/area-colors";
import type { Area } from "@/types/area";
import { reservationStatusLabel } from "@/lib/calendar-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
interface AdminApprovalsClientProps {
  initialReservations: ReservationDetail[];
  areas: Area[];
}

export function AdminApprovalsClient({
  initialReservations,
  areas,
}: AdminApprovalsClientProps) {
  const router = useRouter();
  const [reservations, setReservations] = React.useState(initialReservations);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/reservas/pending");
    if (response.ok) {
      setReservations(await response.json());
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    setLoadingId(id);
    setError(null);
    const response = await fetch(`/api/reservas/${id}/decidir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo procesar la solicitud");
    } else {
      await refresh();
      router.refresh();
    }
    setLoadingId(null);
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {reservations.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay solicitudes pendientes de autorización.
          </CardContent>
        </Card>
      ) : (
        reservations.map((reservation) => {
          const area = areas.find((item) => item.id === reservation.areaId);
          const color = getAreaColor(area ?? null);
          const statusLabel = reservationStatusLabel(reservation);

          return (
            <Card
              key={reservation.id}
              className="border"
              style={areaCardStyle(color)}
            >
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>{reservation.eventName}</CardTitle>
                    <CardDescription>
                      {reservation.areaName ?? area?.name ?? "Sin área"} ·{" "}
                      {new Date(reservation.startAt).toLocaleString("es-MX")} –{" "}
                      {new Date(reservation.endAt).toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </CardDescription>
                  </div>
                  {statusLabel && <Badge variant="outline">{statusLabel}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {reservation.eventDescription && (
                  <p className="text-sm">{reservation.eventDescription}</p>
                )}
                <p className="text-sm">
                  <span className="text-muted-foreground">Espacios: </span>
                  {reservation.spaceNames.join(", ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={loadingId === reservation.id}
                    onClick={() => decide(reservation.id, "approve")}
                  >
                    {loadingId === reservation.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Autorizar"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingId === reservation.id}
                    onClick={() => decide(reservation.id, "reject")}
                  >
                    Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
