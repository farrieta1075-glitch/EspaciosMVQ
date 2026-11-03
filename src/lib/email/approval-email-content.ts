import "server-only";
import { getPendingCreateBatchMembers } from "@/lib/approval-batch";
import {
  buildApprovalChangeSummary,
  formatChangeSummaryHtml,
  formatChangeSummaryText,
  formatDateTimeRange,
} from "@/lib/approval-change-summary";
import { getReservationDetail } from "@/lib/reservation-service";
import { getAllSpaces } from "@/lib/sheets/spaces";
import { getAppBaseUrl } from "@/lib/app-url";
import type { Reservation } from "@/types/reservation";
import { parsePendingPayload } from "@/types/reservation";

export function approvalResponderUrl(reservation: Reservation): string {
  const params = new URLSearchParams({
    id: reservation.id,
    token: reservation.approvalToken,
  });
  return `${getAppBaseUrl()}/aprobaciones/responder?${params.toString()}`;
}

/** Enlace de un clic desde el correo (respuesta HTML mínima, sin layout de la app). */
export function approvalEmailActionUrl(
  reservation: Reservation,
  action: "approve" | "reject",
): string {
  const params = new URLSearchParams({
    token: reservation.approvalToken,
    action,
  });
  return `${getAppBaseUrl()}/api/reservas/${encodeURIComponent(reservation.id)}/accion-correo?${params.toString()}`;
}

function actionLabel(reservation: Reservation): string {
  if (reservation.status === "PENDING") return "nueva reserva";
  if (reservation.pendingAction === "UPDATE") return "cambio de reserva";
  if (reservation.pendingAction === "CANCEL") return "cancelación de reserva";
  return "solicitud de reserva";
}

export async function buildAdminApprovalEmailContent(input: {
  reservation: Reservation;
  areaName: string;
  occurrenceCount?: number;
}): Promise<{
  subject: string;
  text: string;
  html: string;
  responderUrl: string;
}> {
  const { reservation, areaName, occurrenceCount } = input;
  const [detail, allSpaces, batch] = await Promise.all([
    getReservationDetail(reservation.id),
    getAllSpaces(),
    getPendingCreateBatchMembers(reservation),
  ]);
  const batchOccurrences = batch.map((item) => ({
    startAt: item.startAt,
    endAt: item.endAt,
  }));
  const seriesCount = batchOccurrences.length;
  const payload = parsePendingPayload(reservation.pendingPayload);
  const pendingSpaceNames = payload
    ? payload.spaceIds.map(
        (spaceId) =>
          allSpaces.find((space) => space.id === spaceId)?.name ?? spaceId,
      )
    : undefined;

  const summary = buildApprovalChangeSummary({
    reservation,
    spaceNames: detail?.spaceNames ?? [],
    pendingSpaceNames,
    resources: detail?.resources ?? [],
    areaName: detail?.areaName ?? areaName,
  });

  const label = actionLabel(reservation);
  const effectiveCount = seriesCount > 1 ? seriesCount : occurrenceCount;
  const countNote =
    effectiveCount && effectiveCount > 1
      ? ` (${effectiveCount} fechas en la serie)`
      : "";
  const dateLines =
    seriesCount > 1
      ? batchOccurrences.map((item) =>
          formatDateTimeRange(item.startAt, item.endAt),
        )
      : [
          formatDateTimeRange(reservation.startAt, reservation.endAt),
        ];
  const subject = `MVQro Espacios — ${areaName} solicita autorización (${label})${countNote}`;
  const responderUrl = approvalResponderUrl(reservation);
  const approveUrl = approvalEmailActionUrl(reservation, "approve");
  const rejectUrl = approvalEmailActionUrl(reservation, "reject");

  const text = [
    `El área "${areaName}" solicita autorización para una ${label}${countNote}.`,
    `Evento: ${reservation.eventName}`,
    reservation.eventDescription
      ? `Descripción: ${reservation.eventDescription}`
      : "",
    seriesCount > 1 ? "Fechas y horarios:" : `Horario: ${dateLines[0]}`,
    ...(seriesCount > 1 ? dateLines.map((line) => `  · ${line}`) : []),
    detail?.spaceNames?.length
      ? `Espacios: ${detail.spaceNames.join(", ")}`
      : "",
    "",
    formatChangeSummaryText(summary),
    "",
    `Aceptar: ${approveUrl}`,
    `Rechazar: ${rejectUrl}`,
    `Ver detalle: ${responderUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p>El área <strong>${areaName}</strong> solicita autorización para una <strong>${label}</strong>${countNote ? ` <em>${countNote.trim()}</em>` : ""}.</p>
    <ul>
      <li><strong>Evento:</strong> ${reservation.eventName}</li>
      ${reservation.eventDescription ? `<li><strong>Descripción:</strong> ${reservation.eventDescription}</li>` : ""}
      ${
        seriesCount > 1
          ? `<li><strong>Fechas (${seriesCount}):</strong><ul>${dateLines
              .map((line) => `<li>${line}</li>`)
              .join("")}</ul></li>`
          : `<li><strong>Horario:</strong> ${dateLines[0]}</li>`
      }
      ${
        detail?.spaceNames?.length
          ? `<li><strong>Espacios:</strong> ${detail.spaceNames.join(", ")}</li>`
          : ""
      }
    </ul>
    ${formatChangeSummaryHtml(summary)}
    <p style="margin-top:20px;margin-bottom:12px;">
      <a href="${approveUrl}" style="display:inline-block;padding:12px 20px;background:#15803d;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-right:10px;">Aceptar</a><!--
      --><a href="${rejectUrl}" style="display:inline-block;padding:12px 20px;background:#b91c1c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Rechazar</a>
    </p>
    <p style="font-size:12px;color:#666;line-height:1.5;">Un clic registra tu respuesta y muestra una confirmación breve. Si el cliente de correo abre una vista previo, ciérrala para volver al mensaje.</p>
    <p style="margin-top:12px;font-size:13px;"><a href="${responderUrl}" style="color:#6b5344;">Ver detalle completo antes de decidir</a></p>
  `;

  return { subject, text, html, responderUrl };
}
