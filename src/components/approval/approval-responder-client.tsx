"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { ApprovalChangeSummary } from "@/lib/approval-change-summary";
import { ApprovalBatchDatesList } from "@/components/approval/approval-batch-dates";
import { ApprovalChangeView } from "@/components/approval/approval-change-view";
import type { ReservationDetail } from "@/types/reservation";
import { Button } from "@/components/ui/button";

type PreviewResponse = ReservationDetail & {
  changeSummary: ApprovalChangeSummary;
  canRespond: boolean;
  resolutionMessage?: string | null;
  resolutionOutcome?: "approved" | "rejected" | "handled" | null;
  approvalBatchOccurrences?: ReservationDetail["approvalBatchOccurrences"];
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
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-5 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
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
        {preview.approvalBatchOccurrences &&
        preview.approvalBatchOccurrences.length > 1 ? (
          <ApprovalBatchDatesList
            occurrences={preview.approvalBatchOccurrences}
            compact
          />
        ) : (
          <p>
            <strong>Horario:</strong>{" "}
            {formatRange(preview.startAt, preview.endAt)}
          </p>
        )}
        <p>
          <strong>Espacios:</strong>{" "}
          {preview.spaceNames.length > 0
            ? preview.spaceNames.join(", ")
            : "—"}
        </p>
      </div>

      <ApprovalChangeView summary={summary} />

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
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-2 border-t border-border bg-card px-4 py-3 sm:-mx-6 sm:px-6">
          <Button
            disabled={Boolean(submitting)}
            onClick={() => submit("approve")}
            className="min-h-10 flex-1 gap-2 sm:flex-none"
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
            className="min-h-10 flex-1 gap-2 sm:flex-none"
          >
            {submitting === "reject" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Rechazar
          </Button>
        </div>
      )}

      {!outcome && !preview.canRespond && !message && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <p className="font-medium">
            {preview.resolutionOutcome === "rejected"
              ? "Solicitud rechazada"
              : "Solicitud ya autorizada"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {preview.resolutionMessage ??
              "Otro administrador ya atendió esta solicitud. No puedes volver a autorizarla o rechazarla."}
          </p>
        </div>
      )}

      <div className="pt-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/aprobaciones">Ir a aprobaciones</Link>
        </Button>
      </div>
    </div>
  );
}
