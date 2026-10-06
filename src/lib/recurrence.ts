import { formatDateISO } from "@/lib/date-utils";
import type { RecurrenceConfig } from "@/types/reservation";

export interface Occurrence {
  startAt: string;
  endAt: string;
}

const MAX_OCCURRENCES = 52;

export function expandOccurrences(
  date: string,
  startTime: string,
  endTime: string,
  recurrence: RecurrenceConfig,
): Occurrence[] {
  if (recurrence.type === "NONE") {
    return [
      {
        startAt: `${date}T${startTime}:00`,
        endAt: `${date}T${endTime}:00`,
      },
    ];
  }

  const occurrences: Occurrence[] = [];
  const until = new Date(`${recurrence.until}T23:59:59`);
  const current = new Date(`${date}T12:00:00`);

  if (Number.isNaN(current.getTime()) || Number.isNaN(until.getTime())) {
    return [];
  }

  if (until < current) return [];

  while (current <= until && occurrences.length < MAX_OCCURRENCES) {
    const isoDate = formatDateISO(current);
    occurrences.push({
      startAt: `${isoDate}T${startTime}:00`,
      endAt: `${isoDate}T${endTime}:00`,
    });

    if (recurrence.type === "DAILY") {
      current.setDate(current.getDate() + 1);
    } else if (recurrence.type === "WEEKLY") {
      current.setDate(current.getDate() + 7);
    } else {
      break;
    }
  }

  return occurrences;
}

export function serializeRecurrenceRule(recurrence: RecurrenceConfig): string {
  if (recurrence.type === "NONE") return "";
  return JSON.stringify(recurrence);
}
