import "server-only";
import { randomUUID } from "node:crypto";
import { findSimilarEventNames } from "@/lib/event-similarity";
import { notifyAdminsReservationApprovalNeeded } from "@/lib/email/reservation-mailer";
import {
  expandOccurrences,
  serializeRecurrenceRule,
  type Occurrence,
} from "@/lib/recurrence";
import { recordEventUsage, getAllEventNames } from "@/lib/sheets/event-history";
import {
  notifyAreaUsers,
} from "@/lib/sheets/notifications";
import { getAllUserRecords } from "@/lib/sheets/users";
import { appendSheetRow } from "@/lib/sheets/repository";
import {
  formatDateISO,
  formatTimeHHmm,
  parseReservationDateTime,
} from "@/lib/date-utils";
import {
  getActiveReservations,
  getAllReservationResources,
  getReservationById,
  getReservationsNeedingApproval,
  replaceReservationResources,
  updateReservationRecord,
  reservationsOverlap,
} from "@/lib/sheets/reservations";
import { getAllResources } from "@/lib/sheets/resources";
import { getAllSpaces } from "@/lib/sheets/spaces";
import { getAllAreas } from "@/lib/sheets/areas";
import { SHEET_TABS } from "@/lib/sheets/tabs";
import type {
  CreateReservationInput,
  PendingUpdatePayload,
  Reservation,
  ReservationDetail,
  ReservationResource,
  SimilarEventMatch,
  UpdateReservationInput,
} from "@/types/reservation";
import { parsePendingPayload } from "@/types/reservation";

function createApprovalToken(): string {
  return randomUUID().replace(/-/g, "");
}

export async function findSimilarEvents(
  eventName: string,
): Promise<SimilarEventMatch[]> {
  const candidates = await getAllEventNames();
  return findSimilarEventNames(eventName, candidates);
}

function sameSpaceIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

function reservationMatchesSchedule(
  reservation: Reservation,
  date: string,
  startTime: string,
  endTime: string,
): boolean {
  const resStart = parseReservationDateTime(reservation.startAt);
  const resEnd = parseReservationDateTime(reservation.endAt);
  if (!resStart || !resEnd) return false;
  return (
    formatDateISO(resStart) === date &&
    formatTimeHHmm(resStart) === startTime &&
    formatTimeHHmm(resEnd) === endTime
  );
}

type ValidateAvailabilityOptions = {
  /** No revalidar choque de espacios (p. ej. solo cambian recursos). */
  skipSpaceConflictCheck?: boolean;
};

async function validateAvailability(
  spaceIds: string[],
  resources: { resourceId: string; quantity: number }[],
  occurrences: Occurrence[],
  excludeReservationId?: string,
  options?: ValidateAvailabilityOptions,
): Promise<string | null> {
  const [reservations, reservationResources, allResources] = await Promise.all([
    getActiveReservations(),
    getAllReservationResources(),
    getAllResources(),
  ]);

  const excludeId = excludeReservationId?.trim() || undefined;

  for (const occurrence of occurrences) {
    const start =
      parseReservationDateTime(occurrence.startAt) ??
      new Date(occurrence.startAt);
    const end =
      parseReservationDateTime(occurrence.endAt) ??
      new Date(occurrence.endAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return "El rango de horario no es válido.";
    }

    const overlappingIds = new Set<string>();
    for (const reservation of reservations) {
      if (excludeId && reservation.id.trim() === excludeId) {
        continue;
      }
      if (!reservation.startAt || !reservation.endAt) continue;
      const resStart = parseReservationDateTime(reservation.startAt);
      const resEnd = parseReservationDateTime(reservation.endAt);
      if (!resStart || !resEnd) continue;
      if (!reservationsOverlap(start, end, resStart, resEnd)) continue;
      overlappingIds.add(reservation.id);
      if (!options?.skipSpaceConflictCheck) {
        for (const spaceId of reservation.spaceIds) {
          if (spaceIds.includes(spaceId)) {
            return `El espacio ya está reservado el ${start.toLocaleDateString("es-MX")} en ese horario.`;
          }
        }
      }
    }

    const reservedQty = new Map<string, number>();
    for (const link of reservationResources) {
      if (excludeId && link.reservationId.trim() === excludeId) {
        continue;
      }
      if (!overlappingIds.has(link.reservationId)) continue;
      reservedQty.set(
        link.resourceId,
        (reservedQty.get(link.resourceId) ?? 0) + link.quantity,
      );
    }

    for (const item of resources) {
      const resource = allResources.find((r) => r.id === item.resourceId);
      if (!resource) continue;
      const used = reservedQty.get(item.resourceId) ?? 0;
      if (used + item.quantity > resource.totalQty) {
        return `No hay suficiente stock de "${resource.name}" para ${start.toLocaleDateString("es-MX")}.`;
      }
    }
  }

  return null;
}

async function getAreaUserIds(areaId: string): Promise<string[]> {
  const users = await getAllUserRecords();
  return users
    .filter((user) => user.active && user.areaId === areaId)
    .map((user) => user.id);
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<{ ids: string[]; count: number; pending: boolean }> {
  const eventName = input.eventName.trim();
  if (!eventName) throw new Error("El nombre del evento es obligatorio.");
  if (input.spaceIds.length === 0) {
    throw new Error("Selecciona al menos un espacio.");
  }

  const similar = await findSimilarEvents(eventName);
  if (similar.length > 0 && !input.confirmSimilarName) {
    throw new Error(
      `SIMILAR_NAME:${similar[0].eventName}:${Math.round(similar[0].similarity * 100)}`,
    );
  }

  const occurrences = expandOccurrences(
    input.date,
    input.startTime,
    input.endTime,
    input.recurrence,
  );

  if (occurrences.length === 0) {
    throw new Error("No se pudieron generar fechas para la recurrencia.");
  }

  const availabilityError = await validateAvailability(
    input.spaceIds,
    input.resources,
    occurrences,
  );
  if (availabilityError) throw new Error(availabilityError);

  const { createId } = await import("@/lib/id");
  const recurrenceRule = serializeRecurrenceRule(input.recurrence);
  const spaceIdsJson = JSON.stringify(input.spaceIds);
  const createdIds: string[] = [];
  const status = input.createdByAdmin ? "CONFIRMED" : "PENDING";
  const eventDescription = input.eventDescription?.trim() ?? "";
  const approvalToken = input.createdByAdmin ? "" : createApprovalToken();
  let pendingNotifySample: Reservation | null = null;

  for (const occurrence of occurrences) {
    const id = createId("res");
    const reservation: Reservation = {
      id,
      eventName,
      eventDescription,
      spaceIds: input.spaceIds,
      areaId: input.areaId,
      userId: input.userId,
      startAt: occurrence.startAt,
      endAt: occurrence.endAt,
      recurrenceRule,
      status,
      pendingAction: "",
      pendingPayload: "",
      approvalToken,
    };

    await appendSheetRow(SHEET_TABS.RESERVAS, [
      reservation.id,
      reservation.eventName,
      spaceIdsJson,
      reservation.areaId,
      reservation.userId,
      reservation.startAt,
      reservation.endAt,
      reservation.recurrenceRule,
      reservation.status,
      reservation.eventDescription,
      reservation.pendingAction,
      reservation.pendingPayload,
      reservation.approvalToken,
    ]);
    createdIds.push(id);

    for (const resource of input.resources) {
      if (resource.quantity <= 0) continue;
      await appendSheetRow(SHEET_TABS.RESERVA_RECURSOS, [
        id,
        resource.resourceId,
        String(resource.quantity),
      ]);
    }

    if (!input.createdByAdmin) {
      pendingNotifySample = reservation;
    }
  }

  if (pendingNotifySample) {
    await notifyAdminsReservationApprovalNeeded(pendingNotifySample, {
      occurrenceCount: occurrences.length > 1 ? occurrences.length : undefined,
    });
  }

  if (input.createdByAdmin) {
    await recordEventUsage(eventName, input.areaId);
  }

  return { ids: createdIds, count: createdIds.length, pending: !input.createdByAdmin };
}

export async function getReservationsForUserAreaFilter(
  areaId: string | null,
  isAdmin: boolean,
) {
  const reservations = await getActiveReservations();
  if (isAdmin) return reservations;
  if (!areaId) return [];
  return reservations.filter((reservation) => reservation.areaId === areaId);
}

function reservationNeedsApprovalFlag(reservation: Reservation): boolean {
  return (
    reservation.status === "PENDING" ||
    reservation.pendingAction === "UPDATE" ||
    reservation.pendingAction === "CANCEL"
  );
}

async function buildReservationDetailsBatch(
  reservations: Reservation[],
): Promise<ReservationDetail[]> {
  if (reservations.length === 0) return [];

  const [resources, spaces, allReservationResources, areas] = await Promise.all([
    getAllResources(),
    getAllSpaces(),
    getAllReservationResources(),
    getAllAreas(),
  ]);

  const resourcesByReservation = new Map<string, ReservationResource[]>();
  for (const link of allReservationResources) {
    const list = resourcesByReservation.get(link.reservationId) ?? [];
    list.push(link);
    resourcesByReservation.set(link.reservationId, list);
  }

  return reservations.map((reservation) => {
    const reservationResources =
      resourcesByReservation.get(reservation.id) ?? [];

    const spaceNames = reservation.spaceIds.map(
      (spaceId) =>
        spaces.find((space) => space.id === spaceId)?.name ?? spaceId,
    );

    const resourceDetails = reservationResources.map((item) => ({
      resourceId: item.resourceId,
      resourceName:
        resources.find((resource) => resource.id === item.resourceId)?.name ??
        item.resourceId,
      quantity: item.quantity,
    }));

    return {
      ...reservation,
      spaceNames,
      resources: resourceDetails,
      areaName:
        areas.find((area) => area.id === reservation.areaId)?.name ?? null,
      needsApproval: reservationNeedsApprovalFlag(reservation),
    };
  });
}

export async function listAllReservationDetails(): Promise<ReservationDetail[]> {
  const reservations = await getActiveReservations();
  return buildReservationDetailsBatch(reservations);
}

export async function listPendingReservationDetails(): Promise<ReservationDetail[]> {
  const reservations = await getReservationsNeedingApproval();
  return buildReservationDetailsBatch(reservations);
}

export async function listReservationDetails(
  areaId: string | null,
  isAdmin: boolean,
): Promise<ReservationDetail[]> {
  const reservations = await getReservationsForUserAreaFilter(areaId, isAdmin);
  return buildReservationDetailsBatch(reservations);
}

export async function getReservationDetail(
  id: string,
): Promise<ReservationDetail | null> {
  const reservation = await getReservationById(id);
  if (!reservation) return null;
  const [detail] = await buildReservationDetailsBatch([reservation]);
  return detail ?? null;
}

export async function cancelReservation(
  id: string,
  requestedByAdmin = true,
): Promise<{ pending: boolean }> {
  const reservation = await getReservationById(id);
  if (!reservation || reservation.status === "CANCELLED") {
    return { pending: false };
  }

  if (requestedByAdmin) {
    await updateReservationRecord({
      ...reservation,
      status: "CANCELLED",
      pendingAction: "",
      pendingPayload: "",
      approvalToken: "",
    });
    return { pending: false };
  }

  const updated: Reservation = {
    ...reservation,
    pendingAction: "CANCEL",
    pendingPayload: "",
    approvalToken: createApprovalToken(),
  };
  await updateReservationRecord(updated);
  await notifyAdminsReservationApprovalNeeded(updated);
  return { pending: true };
}

export async function updateReservation(
  id: string,
  input: UpdateReservationInput,
): Promise<{ pending: boolean }> {
  const existing = await getReservationById(id);
  if (!existing || existing.status === "CANCELLED") {
    throw new Error("Reserva no encontrada.");
  }

  const eventName = input.eventName.trim();
  if (!eventName) throw new Error("El nombre del evento es obligatorio.");
  if (input.spaceIds.length === 0) {
    throw new Error("Selecciona al menos un espacio.");
  }

  const similar = await findSimilarEvents(eventName);
  const exactExisting = similar.every(
    (item) => item.eventName.toLowerCase() !== existing.eventName.toLowerCase(),
  );
  if (
    similar.length > 0 &&
    exactExisting &&
    !input.confirmSimilarName &&
    eventName.toLowerCase() !== existing.eventName.toLowerCase()
  ) {
    throw new Error(
      `SIMILAR_NAME:${similar[0].eventName}:${Math.round(similar[0].similarity * 100)}`,
    );
  }

  const occurrence = {
    startAt: `${input.date}T${input.startTime}:00`,
    endAt: `${input.date}T${input.endTime}:00`,
  };

  const spacesAndScheduleUnchanged =
    sameSpaceIds(existing.spaceIds, input.spaceIds) &&
    reservationMatchesSchedule(
      existing,
      input.date,
      input.startTime,
      input.endTime,
    );

  const availabilityError = await validateAvailability(
    input.spaceIds,
    input.resources,
    [occurrence],
    id,
    { skipSpaceConflictCheck: spacesAndScheduleUnchanged },
  );
  if (availabilityError) throw new Error(availabilityError);

  if (!input.requestedByAdmin) {
    const payload: PendingUpdatePayload = {
      eventName,
      eventDescription: input.eventDescription?.trim() ?? "",
      spaceIds: input.spaceIds,
      areaId: input.areaId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      resources: input.resources,
    };

    const updated: Reservation = {
      ...existing,
      pendingAction: "UPDATE",
      pendingPayload: JSON.stringify(payload),
      approvalToken: createApprovalToken(),
    };
    await updateReservationRecord(updated);
    await notifyAdminsReservationApprovalNeeded(updated);
    return { pending: true };
  }

  const updated: Reservation = {
    ...existing,
    eventName,
    eventDescription: input.eventDescription?.trim() ?? "",
    spaceIds: input.spaceIds,
    areaId: input.areaId,
    startAt: occurrence.startAt,
    endAt: occurrence.endAt,
    pendingAction: "",
    pendingPayload: "",
    approvalToken: "",
  };

  const ok = await updateReservationRecord(updated);
  if (!ok) throw new Error("No se pudo actualizar la reserva.");

  await replaceReservationResources(id, input.resources);
  await recordEventUsage(eventName, input.areaId);
  return { pending: false };
}

async function applyPendingUpdate(reservation: Reservation): Promise<void> {
  const payload = parsePendingPayload(reservation.pendingPayload);
  if (!payload) throw new Error("Solicitud de cambio inválida.");

  const occurrence = {
    startAt: `${payload.date}T${payload.startTime}:00`,
    endAt: `${payload.date}T${payload.endTime}:00`,
  };

  const updated: Reservation = {
    ...reservation,
    eventName: payload.eventName,
    eventDescription: payload.eventDescription,
    spaceIds: payload.spaceIds,
    areaId: payload.areaId,
    startAt: occurrence.startAt,
    endAt: occurrence.endAt,
    status: "CONFIRMED",
    pendingAction: "",
    pendingPayload: "",
    approvalToken: "",
  };

  await updateReservationRecord(updated);
  await replaceReservationResources(reservation.id, payload.resources);
  await recordEventUsage(payload.eventName, payload.areaId);
}

export async function approveReservation(
  id: string,
): Promise<ReservationDetail | null> {
  const reservation = await getReservationById(id);
  if (!reservation) return null;

  if (reservation.status === "PENDING") {
    const updated: Reservation = {
      ...reservation,
      status: "CONFIRMED",
      approvalToken: "",
    };
    await updateReservationRecord(updated);
    await recordEventUsage(updated.eventName, updated.areaId);
  } else if (reservation.pendingAction === "UPDATE") {
    await applyPendingUpdate(reservation);
  } else if (reservation.pendingAction === "CANCEL") {
    await updateReservationRecord({
      ...reservation,
      status: "CANCELLED",
      pendingAction: "",
      pendingPayload: "",
      approvalToken: "",
    });
  } else {
    throw new Error("Esta reserva no requiere autorización.");
  }

  const areaUserIds = await getAreaUserIds(reservation.areaId);
  const type =
    reservation.status === "PENDING"
      ? "APPROVED_CREATE"
      : reservation.pendingAction === "UPDATE"
        ? "APPROVED_UPDATE"
        : "APPROVED_CANCEL";

  const message =
    reservation.status === "PENDING"
      ? `Tu reserva "${reservation.eventName}" fue autorizada.`
      : reservation.pendingAction === "UPDATE"
        ? `El cambio solicitado para "${reservation.eventName}" fue autorizado.`
        : `La cancelación de "${reservation.eventName}" fue autorizada.`;

  await notifyAreaUsers(
    reservation.areaId,
    reservation.id,
    type,
    message,
    areaUserIds,
  );

  return getReservationDetail(id);
}

export async function rejectReservation(
  id: string,
): Promise<ReservationDetail | null> {
  const reservation = await getReservationById(id);
  if (!reservation) return null;

  const areaUserIds = await getAreaUserIds(reservation.areaId);

  if (reservation.status === "PENDING") {
    await updateReservationRecord({
      ...reservation,
      status: "CANCELLED",
      approvalToken: "",
    });
    await notifyAreaUsers(
      reservation.areaId,
      reservation.id,
      "REJECTED_CREATE",
      `Tu solicitud de reserva "${reservation.eventName}" fue rechazada.`,
      areaUserIds,
    );
  } else if (reservation.pendingAction === "UPDATE") {
    await updateReservationRecord({
      ...reservation,
      pendingAction: "",
      pendingPayload: "",
      approvalToken: "",
    });
    await notifyAreaUsers(
      reservation.areaId,
      reservation.id,
      "REJECTED_UPDATE",
      `El cambio solicitado para "${reservation.eventName}" fue rechazado. La reserva original se mantiene.`,
      areaUserIds,
    );
  } else if (reservation.pendingAction === "CANCEL") {
    await updateReservationRecord({
      ...reservation,
      pendingAction: "",
      pendingPayload: "",
      approvalToken: "",
    });
    await notifyAreaUsers(
      reservation.areaId,
      reservation.id,
      "REJECTED_CANCEL",
      `La cancelación de "${reservation.eventName}" fue rechazada. La reserva sigue confirmada.`,
      areaUserIds,
    );
  } else {
    throw new Error("Esta reserva no requiere autorización.");
  }

  return getReservationDetail(id);
}

export async function decideReservationByToken(input: {
  id: string;
  token: string;
  approve: boolean;
}): Promise<ReservationDetail | null> {
  const reservation = await getReservationById(input.id);
  if (!reservation || !reservation.approvalToken) return null;
  if (reservation.approvalToken !== input.token) return null;

  return input.approve
    ? approveReservation(input.id)
    : rejectReservation(input.id);
}
