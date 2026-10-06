import type {
  PendingUpdatePayload,
  Reservation,
  ReservationResourceDetail,
} from "@/types/reservation";
import { parsePendingPayload } from "@/types/reservation";

export interface ApprovalChangeLine {
  label: string;
  before: string;
  after: string;
}

export interface ApprovalChangeSummary {
  action: "CREATE" | "UPDATE" | "CANCEL";
  actionLabel: string;
  resources: ReservationResourceDetail[];
  pendingResources: ReservationResourceDetail[] | null;
  changes: ApprovalChangeLine[];
}

function formatDateTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startAt} – ${endAt}`;
  }
  const date = start.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const t1 = start.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const t2 = end.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${t1} – ${t2}`;
}

function formatResourceList(
  resources: ReservationResourceDetail[],
): string {
  if (resources.length === 0) return "Ninguno";
  return resources
    .map((item) => `${item.resourceName} × ${item.quantity}`)
    .join(", ");
}

function pendingResourcesFromPayload(
  payload: PendingUpdatePayload,
  nameById: Map<string, string>,
): ReservationResourceDetail[] {
  return payload.resources
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      resourceId: item.resourceId,
      resourceName: nameById.get(item.resourceId) ?? item.resourceId,
      quantity: item.quantity,
    }));
}

export function buildApprovalChangeSummary(input: {
  reservation: Reservation;
  spaceNames: string[];
  pendingSpaceNames?: string[];
  resources: ReservationResourceDetail[];
  areaName?: string | null;
}): ApprovalChangeSummary {
  const { reservation, spaceNames, pendingSpaceNames, resources, areaName } =
    input;

  if (reservation.pendingAction === "CANCEL") {
    return {
      action: "CANCEL",
      actionLabel: "Cancelación de reserva",
      resources,
      pendingResources: null,
      changes: [],
    };
  }

  const payload = parsePendingPayload(reservation.pendingPayload);
  if (reservation.pendingAction === "UPDATE" && payload) {
    const nameById = new Map<string, string>();
    for (const resource of resources) {
      nameById.set(resource.resourceId, resource.resourceName);
    }
    const pendingResources = pendingResourcesFromPayload(payload, nameById);
    const pendingStart = `${payload.date}T${payload.startTime}:00`;
    const pendingEnd = `${payload.date}T${payload.endTime}:00`;

    const changes: ApprovalChangeLine[] = [];

    if (payload.eventName !== reservation.eventName) {
      changes.push({
        label: "Evento",
        before: reservation.eventName,
        after: payload.eventName,
      });
    }

    const beforeRange = formatDateTimeRange(
      reservation.startAt,
      reservation.endAt,
    );
    const afterRange = formatDateTimeRange(pendingStart, pendingEnd);
    if (beforeRange !== afterRange) {
      changes.push({
        label: "Horario",
        before: beforeRange,
        after: afterRange,
      });
    }

    const beforeSpaces = spaceNames.join(", ") || "—";
    const afterSpaces =
      pendingSpaceNames?.join(", ") || payload.spaceIds.join(", ") || "—";
    if (beforeSpaces !== afterSpaces) {
      changes.push({
        label: "Espacios (IDs)",
        before: beforeSpaces,
        after: afterSpaces,
      });
    }

    const beforeResources = formatResourceList(resources);
    const afterResources = formatResourceList(pendingResources);
    if (beforeResources !== afterResources) {
      changes.push({
        label: "Recursos",
        before: beforeResources,
        after: afterResources,
      });
    }

    if (payload.eventDescription !== reservation.eventDescription) {
      changes.push({
        label: "Descripción",
        before: reservation.eventDescription || "—",
        after: payload.eventDescription || "—",
      });
    }

    if (areaName && payload.areaId !== reservation.areaId) {
      changes.push({
        label: "Área",
        before: areaName,
        after: payload.areaId,
      });
    }

    if (changes.length === 0) {
      changes.push({
        label: "Cambio",
        before: "Sin diferencias detectadas en campos clave",
        after: "Revisar en la aplicación",
      });
    }

    return {
      action: "UPDATE",
      actionLabel: "Cambio de reserva",
      resources,
      pendingResources,
      changes,
    };
  }

  return {
    action: "CREATE",
    actionLabel: "Nueva reserva",
    resources,
    pendingResources: null,
    changes: [],
  };
}

export function formatChangeSummaryText(summary: ApprovalChangeSummary): string {
  const lines: string[] = [];

  if (summary.action === "CREATE") {
    lines.push("Recursos solicitados:");
    lines.push(formatResourceList(summary.resources));
    return lines.join("\n");
  }

  if (summary.action === "CANCEL") {
    lines.push("Recursos solicitados:");
    lines.push(formatResourceList(summary.resources));
    return lines.join("\n");
  }

  lines.push("Cambios solicitados:");
  for (const change of summary.changes) {
    lines.push(`- ${change.label}: «${change.before}» → «${change.after}»`);
  }
  if (summary.pendingResources) {
    lines.push("");
    lines.push("Recursos después del cambio:");
    lines.push(formatResourceList(summary.pendingResources));
  }
  return lines.join("\n");
}

export function formatChangeSummaryHtml(summary: ApprovalChangeSummary): string {
  if (summary.action === "CREATE") {
    const items = summary.resources
      .map(
        (item) =>
          `<li><strong>${escapeHtml(item.resourceName)}</strong> — cantidad: ${item.quantity}</li>`,
      )
      .join("");
    return `<p><strong>Recursos solicitados</strong></p><ul>${items || "<li>Ninguno</li>"}</ul>`;
  }

  if (summary.action === "CANCEL") {
    const items = summary.resources
      .map(
        (item) =>
          `<li><strong>${escapeHtml(item.resourceName)}</strong> — cantidad: ${item.quantity}</li>`,
      )
      .join("");
    return `<p><strong>Recursos solicitados</strong></p><ul>${items || "<li>Ninguno</li>"}</ul>`;
  }

  const rows = summary.changes
    .map(
      (change) =>
        `<tr><td style="padding:6px 8px;border:1px solid #ddd;"><strong>${escapeHtml(change.label)}</strong></td><td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(change.before)}</td><td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(change.after)}</td></tr>`,
    )
    .join("");

  const pendingResources = summary.pendingResources
    ? `<p><strong>Recursos después del cambio:</strong></p><ul>${summary.pendingResources
        .map(
          (item) =>
            `<li>${escapeHtml(item.resourceName)} × ${item.quantity}</li>`,
        )
        .join("")}</ul>`
    : "";

  return `
    <p><strong>Cambios solicitados</strong></p>
    <table style="border-collapse:collapse;width:100%;max-width:640px;font-size:14px;">
      <thead>
        <tr>
          <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Campo</th>
          <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Actual</th>
          <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Solicitado</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${pendingResources}
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
