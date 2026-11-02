import { formatDateISO } from "@/lib/date-utils";
import type { RecurrenceType } from "@/types/reservation";

/** Número de eventos que define el “hasta” por defecto al elegir recurrencia. */
export const DEFAULT_RECURRENCE_OCCURRENCES = 10;

export function defaultRecurrenceUntil(
  startDateIso: string,
  type: RecurrenceType,
): string {
  const start = new Date(`${startDateIso}T12:00:00`);
  const end = new Date(start);

  switch (type) {
    case "DAILY":
      end.setDate(start.getDate() + (DEFAULT_RECURRENCE_OCCURRENCES - 1));
      break;
    case "WEEKLY":
      end.setDate(start.getDate() + 7 * (DEFAULT_RECURRENCE_OCCURRENCES - 1));
      break;
    case "BIWEEKLY":
      end.setDate(start.getDate() + 14 * (DEFAULT_RECURRENCE_OCCURRENCES - 1));
      break;
    case "MONTHLY_FIXED":
    case "MONTHLY_RELATIVE":
      end.setMonth(start.getMonth() + (DEFAULT_RECURRENCE_OCCURRENCES - 1));
      break;
    default:
      return startDateIso;
  }

  return formatDateISO(end);
}
