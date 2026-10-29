import { formatDateISO } from "@/lib/date-utils";
import type { RecurrenceConfig, RecurrenceType } from "@/types/reservation";

export interface Occurrence {
  startAt: string;
  endAt: string;
}

const MAX_OCCURRENCES = 52;

export function listRecurrenceDates(
  date: string,
  recurrenceType: RecurrenceType,
  until: string,
): string[] {
  if (recurrenceType === "NONE" || !until) {
    return date ? [date] : [];
  }

  const dates: string[] = [];
  const untilDate = new Date(`${until}T23:59:59`);
  const current = new Date(`${date}T12:00:00`);

  if (Number.isNaN(current.getTime()) || Number.isNaN(untilDate.getTime())) {
    return [];
  }
  if (untilDate < current) return [];

  while (current <= untilDate && dates.length < MAX_OCCURRENCES) {
    dates.push(formatDateISO(current));
    if (recurrenceType === "DAILY") {
      current.setDate(current.getDate() + 1);
    } else if (recurrenceType === "WEEKLY") {
      current.setDate(current.getDate() + 7);
    } else {
      break;
    }
  }

  return dates;
}

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

  const exceptSet = new Set(recurrence.exceptDates ?? []);
  const dates = listRecurrenceDates(date, recurrence.type, recurrence.until);
  const occurrences: Occurrence[] = [];

  for (const isoDate of dates) {
    if (exceptSet.has(isoDate)) continue;
    occurrences.push({
      startAt: `${isoDate}T${startTime}:00`,
      endAt: `${isoDate}T${endTime}:00`,
    });
  }

  return occurrences;
}

export function serializeRecurrenceRule(recurrence: RecurrenceConfig): string {
  if (recurrence.type === "NONE") return "";
  return JSON.stringify(recurrence);
}

export function parseRecurrenceRule(raw: string): RecurrenceConfig | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as RecurrenceConfig;
    if (!parsed?.type) return null;
    return {
      type: parsed.type,
      until: parsed.until ?? "",
      exceptDates: Array.isArray(parsed.exceptDates)
        ? parsed.exceptDates.filter(Boolean)
        : [],
    };
  } catch {
    return null;
  }
}
