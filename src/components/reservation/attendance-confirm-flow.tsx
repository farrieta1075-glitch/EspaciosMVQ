"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { ReservationDetail } from "@/types/reservation";
import { formatReservationDateTimeRange } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AttendanceConfirmFlowProps {
  reservation: ReservationDetail;
}

export function AttendanceConfirmFlow({
  reservation,
}: AttendanceConfirmFlowProps) {
  const router = useRouter();
  const [actualAttendees, setActualAttendees] = React.useState(
    reservation.actualAttendees != null
      ? String(reservation.actualAttendees)
      : reservation.estimatedAttendees > 0
        ? String(reservation.estimatedAttendees)
        : "",
  );
  const [attendanceComment, setAttendanceComment] = React.useState(
    reservation.attendanceComment ?? "",
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successOpen, setSuccessOpen] = React.useState(false);

  async function submit() {
    const count = Number(actualAttendees);
    if (!Number.isFinite(count) || count <= 0) {
      setError("Indica cuántos asistentes hubo.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/reservas/${reservation.id}/asistencia`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actualAttendees: count,
            attendanceComment: attendanceComment.trim(),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo guardar");
      }
      setSuccessOpen(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold">{reservation.eventName}</h2>
        <p className="text-sm text-muted-foreground">
          {formatReservationDateTimeRange(
            reservation.startAt,
            reservation.endAt,
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Espacios: {reservation.spaceNames.join(", ") || "—"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="actualAttendees">Cantidad de asistentes</Label>
        <Input
          id="actualAttendees"
          type="number"
          min={1}
          value={actualAttendees}
          onChange={(event) => setActualAttendees(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="attendanceComment">Comentario (opcional)</Label>
        <textarea
          id="attendanceComment"
          value={attendanceComment}
          onChange={(event) => setAttendanceComment(event.target.value)}
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Observaciones sobre el evento..."
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button className="w-full" disabled={loading} onClick={submit}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          "Confirmar asistencia"
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
              Asistencia registrada
            </DialogTitle>
            <DialogDescription>
              Los datos de asistencia se guardaron correctamente.
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
