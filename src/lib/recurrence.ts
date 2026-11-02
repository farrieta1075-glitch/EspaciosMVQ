import { formatDateISO } from "@/lib/date-utils";
import {
  dateForMonthlyRelativeInMonth,
  type MonthlyRelativeOrdinal,
} from "@/lib/monthly-relative-recurrence";
import type { RecurrenceConfig, RecurrenceType } from "@/types/reservation";

export interface Occurrence {
  startAt: string;
  endAt: string;
}

const MAX_OCCURRENCES = 120;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatDateISO(d);
}

function addMonthsKeepDay(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(d, lastDay));
  return formatDateISO(date);
}

export function listRecurrenceDates(
  date: string,
  recurrenceType: RecurrenceType,
  until: string,
  config?: Pick<
    RecurrenceConfig,
    "customDates" | "monthlyRelative"
  >,
): string[] {
  if (recurrenceType === "NONE" || !date) {
    return date ? [date] : [];
  }

  if (recurrenceType === "CUSTOM") {
    const custom = [...(config?.customDates ?? [])].filter(Boolean).sort();
    return custom.length > 0 ? custom : [date];
  }

  if (!until) return [date];

  const untilDate = new Date(`${until}T23:59:59`);
  const startDate = new Date(`${date}T12:00:00`);
  if (Number.isNaN(untilDate.getTime()) || Number.isNaN(startDate.getTime())) {
    return [];
  }
  if (untilDate < startDate) return [];

  const dates: string[] = [];
  let current = date;

  if (recurrenceType === "MONTHLY_FIXED") {
    const dayOfMonth = startDate.getDate();
    let cursor = new Date(startDate.getTime());
    while (cursor <= untilDate && dates.length < MAX_OCCURRENCES) {
      dates.push(formatDateISO(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, dayOfMonth);
      const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      if (dayOfMonth > last) {
        cursor.setDate(last);
      }
    }
    return dates;
  }

  if (recurrenceType === "MONTHLY_RELATIVE" && config?.monthlyRelative) {
    let cursor = new Date(`${date}T12:00:00`);
    while (cursor <= untilDate && dates.length < MAX_OCCURRENCES) {
      const iso = dateForMonthlyRelativeInMonth(
        cursor.getFullYear(),
        cursor.getMonth(),
        config.monthlyRelative,
      );
      if (iso) {
        const isoDate = new Date(`${iso}T12:00:00`);
        if (isoDate >= startDate && isoDate <= untilDate) {
          dates.push(iso);
        }
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return dates;
  }

  while (current <= formatDateISO(untilDate) && dates.length < MAX_OCCURRENCES) {
    dates.push(current);
    if (recurrenceType === "DAILY") {
      current = addDays(current, 1);
    } else if (recurrenceType === "WEEKLY") {
      current = addDays(current, 7);
    } else if (recurrenceType === "BIWEEKLY") {
      current = addDays(current, 14);
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
  const dates = listRecurrenceDates(
    date,
    recurrence.type,
    recurrence.type === "CUSTOM" ? "" : recurrence.until,
    recurrence,
  );
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
      customDates: Array.isArray(parsed.customDates)
        ? parsed.customDates.filter(Boolean)
        : [],
      monthlyRelative: parsed.monthlyRelative,
    };
  } catch {
    return null;
  }
}

export const RECURRENCE_TYPE_LABELS: Record<RecurrenceType, string> = {
  NONE: "Sin recurrencia",
  DAILY: "Diaria",
  WEEKLY: "Semanal",
  BIWEEKLY: "Cada dos semanas",
  MONTHLY_FIXED: "Mensual (fijo)",
  MONTHLY_RELATIVE: "Mensual (relativo)",
  CUSTOM: "Personalizada",
};

export function ordinalLabelEs(ordinal: MonthlyRelativeOrdinal): string {
  switch (ordinal) {
    case "FIRST":
      return "primer";
    case "SECOND":
      return "segundo";
    case "THIRD":
      return "tercer";
    case "FOURTH":
      return "cuarto";
    case "LAST":
      return "último";
    default:
      return "";
  }
}
