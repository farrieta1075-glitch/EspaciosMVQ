export type ReservationStatus = "CONFIRMED" | "CANCELLED" | "PENDING";

export type PendingAction = "" | "UPDATE" | "CANCEL";

export interface Reservation {
  id: string;
  eventName: string;
  eventDescription: string;
  spaceIds: string[];
  areaId: string;
  userId: string;
  startAt: string;
  endAt: string;
  recurrenceRule: string;
  status: ReservationStatus;
  pendingAction: PendingAction;
  pendingPayload: string;
  approvalToken: string;
}

export interface PendingUpdatePayload {
  eventName: string;
  eventDescription: string;
  spaceIds: string[];
  areaId: string;
  date: string;
  startTime: string;
  endTime: string;
  resources: { resourceId: string; quantity: number }[];
}

export interface ReservationResource {
  reservationId: string;
  resourceId: string;
  quantity: number;
}

export type SpaceAvailabilityStatus = "available" | "occupied";

export interface SpaceAvailability {
  id: string;
  status: SpaceAvailabilityStatus;
}

export interface ResourceAvailability {
  id: string;
  name: string;
  type: string;
  imageUrl: string;
  totalQty: number;
  availableQty: number;
  scope: string;
}

export interface MapDateSelection {
  date: string;
  startTime: string;
  endTime: string;
  mapId: string;
  selectedSpaceIds: string[];
  selectedResources: { resourceId: string; quantity: number }[];
}

export interface AvailabilityResponse {
  spaces: SpaceAvailability[];
  resources: ResourceAvailability[];
}

export type RecurrenceType = "NONE" | "DAILY" | "WEEKLY";

export interface RecurrenceConfig {
  type: RecurrenceType;
  until: string;
}

export interface CreateReservationInput {
  eventName: string;
  eventDescription?: string;
  spaceIds: string[];
  areaId: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  recurrence: RecurrenceConfig;
  resources: { resourceId: string; quantity: number }[];
  confirmSimilarName?: boolean;
  createdByAdmin?: boolean;
}

export interface EventSuggestion {
  eventName: string;
  areaId: string;
  count: number;
  priority: number;
}

export interface SimilarEventMatch {
  eventName: string;
  similarity: number;
}

export interface ReservationResourceDetail {
  resourceId: string;
  resourceName: string;
  quantity: number;
}

export interface ReservationDetail extends Reservation {
  resources: ReservationResourceDetail[];
  spaceNames: string[];
  areaName?: string | null;
  needsApproval?: boolean;
}

export interface UpdateReservationInput {
  eventName: string;
  eventDescription?: string;
  spaceIds: string[];
  areaId: string;
  date: string;
  startTime: string;
  endTime: string;
  resources: { resourceId: string; quantity: number }[];
  confirmSimilarName?: boolean;
  requestedByAdmin?: boolean;
}

export function parsePendingPayload(raw: string): PendingUpdatePayload | null {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as PendingUpdatePayload;
  } catch {
    return null;
  }
}

export function reservationNeedsAdminAction(reservation: Reservation): boolean {
  if (reservation.status === "PENDING") return true;
  return reservation.pendingAction === "UPDATE" || reservation.pendingAction === "CANCEL";
}
