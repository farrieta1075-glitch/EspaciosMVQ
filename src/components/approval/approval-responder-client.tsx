"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { ApprovalChangeSummary } from "@/lib/approval-change-summary";
import type { ReservationDetail } from "@/types/reservation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PreviewResponse = ReservationDetail & {
  changeSummary: ApprovalChangeSummary;
  canRespond: boolean;
};

function formatRange(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startAt} – ${endAt}`;
  }
  return `${start.toLocaleString("es-MX")} – ${end.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
}

export function ApprovalResponderClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(true);
  const [submitting, setSubmitting] = React.useState<"approve" | "reject" | null>(
    null,
  );
  const [outcome, setOutcome] = React.useState<"approved" | "rejected" | null>(
    null,
  );
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const decision = searchParams.get("decision");
    if (!decision || !id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("decision");
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", next);
  }, [id, searchParams]);

  React.useEffect(() => {
    if (!id) {
      setLoadingPreview(false);
      return;
    }

    async function loadPreview() {
      setLoadingPreview(true);
      setLoadError(null);
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      const response = await fetch(`/api/reservas/${id}/decidir${query}`);
      const data = await response.json();
      if (!response.ok) {
        setLoadError(data.error ?? "No se pudo cargar la solicitud.");
        setPreview(null);
      } else {
        setPreview(data as PreviewResponse);
      }
      setLoadingPreview(false);
    }

    loadPreview();
  }, [id, token]);

  async function submit(action: "approve" | "reject") {
    if (!id || submitting) return;
    setSubmitting(action);
    setMessage(null);

    const response = await fetch(`/api/reservas/${id}/decidir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token: token ?? undefined }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo procesar la solicitud.");
      setSubmitting(null);
      return;
    }

    setOutcome(action === "approve" ? "approved" : "rejected");
    setMessage(
      action === "approve"
        ? "La solicitud fue autorizada correctamente."
        : "La solicitud fue rechazada.",
    );
    setSubmitting(null);
    setPreview((current) =>
      current ? { ...current, canRespond: false } : current,
    );
  }

  if (!id) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Enlace de aprobación inválido.</p>
      </div>
    );
  }

  if (loadingPreview) {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando solicitud…
      </div>
    );
  }

  if (loadError || !preview) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-destructive/30 bg-card p-6">
        <p className="text-sm text-destructive">{loadError ?? "Solicitud no disponible."}</p>
      </div>
    );
  }

  const summary = preview.changeSummary;

  return (
    <div className="mx-auto max-w-2xl space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Solicitud de aprobación</h1>
        <p className="text-sm text-muted-foreground">
          {summary.actionLabel} · {preview.areaName ?? preview.areaId}
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p>
          <strong>Evento:</strong> {preview.eventName}
        </p>
        {preview.eventDescription ? (
          <p>
            <strong>Descripción:</strong> {preview.eventDescription}
          </p>
        ) : null}
        <p>
          <strong>Horario:</strong> {formatRange(preview.startAt, preview.endAt)}
        </p>
        <p>
          <strong>Espacios:</strong>{" "}
          {preview.spaceNames.length > 0
            ? preview.spaceNames.join(", ")
            : "—"}
        </p>
      </div>

      {summary.action === "CREATE" && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Recursos solicitados</h2>
          {summary.resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="list-inside list-disc text-sm">
              {summary.resources.map((item) => (
                <li key={item.resourceId}>
                  {item.resourceName} × {item.quantity}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {summary.action === "CANCEL" && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold">Cancelación solicitada</h2>
          <p className="text-sm text-muted-foreground">
            Se solicita cancelar la reserva confirmada con los recursos actuales.
          </p>
          <ul className="list-inside list-disc text-sm">
            {summary.resources.map((item) => (
              <li key={item.resourceId}>
                {item.resourceName} × {item.quantity}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.action === "UPDATE" && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Cambios solicitados</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-medium">Campo</th>
                  <th className="px-3 py-2 font-medium">Actual</th>
                  <th className="px-3 py-2 font-medium">Solicitado</th>
                </tr>
              </thead>
              <tbody>
                {summary.changes.map((change) => (
                  <tr key={change.label} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{change.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {change.before}
                    </td>
                    <td className="px-3 py-2">{change.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {outcome && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 ${
            outcome === "approved"
              ? "border-green-500/40 bg-green-500/10"
              : "border-red-500/40 bg-red-500/10"
          }`}
          role="status"
          aria-live="polite"
        >
          {outcome === "approved" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700 dark:text-green-400" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
          )}
          <div>
            <p className="font-medium">
              {outcome === "approved" ? "Autorizada" : "Rechazada"}
            </p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      )}

      {!outcome && message && (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}

      {!outcome && preview.canRespond && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            disabled={Boolean(submitting)}
            onClick={() => submit("approve")}
            className="gap-2"
          >
            {submitting === "approve" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Autorizar
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(submitting)}
            onClick={() => submit("reject")}
            className="gap-2"
          >
            {submitting === "reject" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Rechazar
          </Button>
        </div>
      )}

      {!outcome && !preview.canRespond && !message && (
        <Badge variant="secondary">Esta solicitud ya fue procesada.</Badge>
      )}

      <div className="pt-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/aprobaciones">Ir a aprobaciones</Link>
        </Button>
      </div>
    </div>
  );
}
