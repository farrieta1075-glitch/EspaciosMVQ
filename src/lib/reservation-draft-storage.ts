import type { MapDateSelection, RecurrenceType } from "@/types/reservation";

const DRAFT_KEY = "mvqro_reservation_draft";
const PICK_DATE_KEY = "mvqro_reservation_pick_date";

export type ReservationWizardConfirmed = {
  area: boolean;
  eventName: boolean;
  eventDescription: boolean;
  attendees: boolean;
  recurrence: boolean;
  scheduleCollapsed: boolean;
  date: boolean;
  time: boolean;
};

export interface ReservationDraft {
  kind: "create" | "edit";
  editReservationId?: string;
  eventName: string;
  eventDescription: string;
  estimatedAttendees: string;
  attendeeJustificationCode: string;
  attendeeJustificationNote: string;
  recurrenceType: RecurrenceType;
  recurrenceUntil: string;
  recurrenceExceptDates: string[];
  recurrenceCustomDates?: string[];
  sendEventReminder: boolean;
  areaId: string;
  reservationAreaId?: string;
  selection: MapDateSelection | null;
  wizardConfirmed?: ReservationWizardConfirmed;
  /** Fecha mostrada al abrir el calendario (para confirmar al volver). */
  calendarAnchorDate?: string;
}

export function saveReservationDraft(draft: ReservationDraft): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadReservationDraft(): ReservationDraft | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReservationDraft;
  } catch {
    return null;
  }
}

export function clearReservationDraft(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(DRAFT_KEY);
}

export function setPickedReservationDate(isoDate: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PICK_DATE_KEY, isoDate);
}

export function consumePickedReservationDate(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const value = sessionStorage.getItem(PICK_DATE_KEY);
  if (value) sessionStorage.removeItem(PICK_DATE_KEY);
  return value;
}

export function buildCalendarPickUrl(returnTo: string, currentDate: string): string {
  const params = new URLSearchParams({
    pick: "1",
    returnTo,
    date: currentDate,
  });
  return `/calendario?${params.toString()}`;
}
