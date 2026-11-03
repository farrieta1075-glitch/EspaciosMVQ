import { formatDateDisplay, formatDateISO } from "@/lib/date-utils";
import { defaultRecurrenceUntil } from "@/lib/recurrence-default-until";
import {
  inferMonthlyRelativeFromDate,
  weekdayNameEs,
} from "@/lib/monthly-relative-recurrence";
import {
  listRecurrenceDates,
  ordinalLabelEs,
  RECURRENCE_TYPE_LABELS,
} from "@/lib/recurrence";
import type { RecurrenceConfig, RecurrenceType } from "@/types/reservation";

const PREVIEW_OCCURRENCE_COUNT = 8;

function dayDelta(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00`).getTime();
  const b = new Date(`${toIso}T12:00:00`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function shiftDateIso(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return formatDateISO(d);
}

export function buildRecurrenceForTypeAtDate(
  type: RecurrenceType,
  newDate: string,
  previous: RecurrenceConfig,
): RecurrenceConfig {
  if (type === "NONE") {
    return {
      type: "NONE",
      until: "",
      exceptDates: [],
      customDates: [],
    };
  }

  const until =
    type === "CUSTOM"
      ? previous.until
      : defaultRecurrenceUntil(newDate, type);

  if (type === "MONTHLY_RELATIVE") {
    const inferred = inferMonthlyRelativeFromDate(newDate);
    return {
      type,
      until,
      exceptDates: previous.exceptDates ?? [],
      customDates: [],
      monthlyRelative: {
        weekday: inferred.weekday,
        ordinal: inferred.ordinal,
      },
    };
  }

  return {
    type,
    until,
    exceptDates: previous.exceptDates ?? [],
    customDates:
      type === "CUSTOM"
        ? (previous.customDates?.length
            ? previous.customDates
            : [newDate]
          ).filter(Boolean)
        : [],
    monthlyRelative: undefined,
  };
}

export function applyRecurrenceToNewStartDate(
  newDate: string,
  recurrence: RecurrenceConfig,
  anchorDate?: string,
): RecurrenceConfig {
  if (recurrence.type === "NONE") {
    return recurrence;
  }
  let next: RecurrenceConfig = { ...recurrence };
  if (
    next.type === "CUSTOM" &&
    anchorDate &&
    anchorDate !== newDate
  ) {
    const delta = dayDelta(anchorDate, newDate);
    return {
      ...next,
      customDates: (recurrence.customDates ?? [])
        .filter(Boolean)
        .map((iso) => shiftDateIso(iso, delta))
        .sort(),
    };
  }
  if (next.type === "MONTHLY_RELATIVE") {
    const inferred = inferMonthlyRelativeFromDate(newDate);
    next = {
      ...next,
      monthlyRelative: {
        weekday: inferred.weekday,
        ordinal: inferred.ordinal,
      },
      until:
        next.until?.trim() && next.until >= newDate
          ? next.until
          : defaultRecurrenceUntil(newDate, "MONTHLY_RELATIVE"),
    };
  } else if (
    next.until?.trim() &&
    next.until < newDate &&
    next.type !== "CUSTOM"
  ) {
    next = {
      ...next,
      until: defaultRecurrenceUntil(newDate, next.type),
    };
  }
  return next;
}

export function describeRecurrencePattern(
  anchorDate: string,
  recurrence: RecurrenceConfig,
): string {
  if (!anchorDate) return "";
  if (recurrence.type === "NONE") {
    return `Sin recurrencia (${formatDateDisplay(new Date(`${anchorDate}T12:00:00`))})`;
  }

  const base = RECURRENCE_TYPE_LABELS[recurrence.type];
  const untilPart =
    recurrence.until && recurrence.type !== "CUSTOM"
      ? `, hasta ${formatDateDisplay(new Date(`${recurrence.until}T12:00:00`))}`
      : "";

  switch (recurrence.type) {
    case "DAILY":
      return `${base} (cada día${untilPart})`;
    case "WEEKLY": {
      const wd = weekdayNameEs(new Date(`${anchorDate}T12:00:00`).getDay());
      return `${base} los ${wd}s${untilPart}`;
    }
    case "BIWEEKLY": {
      const wd = weekdayNameEs(new Date(`${anchorDate}T12:00:00`).getDay());
      return `${base} los ${wd}s${untilPart}`;
    }
    case "MONTHLY_FIXED": {
      const day = new Date(`${anchorDate}T12:00:00`).getDate();
      return `${base}: día ${day} de cada mes${untilPart}`;
    }
    case "MONTHLY_RELATIVE": {
      const mr =
        recurrence.monthlyRelative ?? inferMonthlyRelativeFromDate(anchorDate);
      return `${base}: ${ordinalLabelEs(mr.ordinal)} ${weekdayNameEs(mr.weekday)} de cada mes${untilPart}`;
    }
    case "CUSTOM": {
      const n = recurrence.customDates?.length ?? 0;
      return `${base}: ${n} fecha(s) elegidas manualmente`;
    }
    default:
      return `${base}${untilPart}`;
  }
}

export interface MappedException {
  from: string;
  to: string;
}

export interface CalendarDateChangePreview {
  beforePattern: string;
  afterPattern: string;
  patternChanged: boolean;
  beforeSampleDates: string[];
  afterSampleDates: string[];
  mappedExceptions: MappedException[];
}

function sampleRecurrenceDates(
  anchorDate: string,
  recurrence: RecurrenceConfig,
): string[] {
  if (recurrence.type === "NONE" || !anchorDate) {
    return anchorDate ? [anchorDate] : [];
  }
  const until =
    recurrence.type === "CUSTOM" ? "" : recurrence.until || anchorDate;
  const all = listRecurrenceDates(anchorDate, recurrence.type, until, recurrence);
  return all.slice(0, PREVIEW_OCCURRENCE_COUNT);
}

export function buildCalendarDateChangePreview(
  anchorDate: string,
  newDate: string,
  recurrence: RecurrenceConfig,
  afterRecurrenceOverride?: RecurrenceConfig,
): CalendarDateChangePreview {
  const beforeRecurrence = recurrence;
  const afterRecurrence =
    afterRecurrenceOverride ??
    applyRecurrenceToNewStartDate(newDate, recurrence, anchorDate);

  const beforePattern = describeRecurrencePattern(anchorDate, beforeRecurrence);
  const afterPattern = describeRecurrencePattern(newDate, afterRecurrence);
  const patternChanged = beforePattern !== afterPattern;

  const beforeSampleDates = sampleRecurrenceDates(anchorDate, beforeRecurrence);
  const afterSampleDates = sampleRecurrenceDates(newDate, afterRecurrence);

  const exceptDates = recurrence.exceptDates ?? [];
  const mappedExceptions: MappedException[] = [];

  if (exceptDates.length > 0 && recurrence.type !== "NONE") {
    const until =
      recurrence.type === "CUSTOM" ? "" : recurrence.until || anchorDate;
    const oldDates = listRecurrenceDates(
      anchorDate,
      recurrence.type,
      until,
      beforeRecurrence,
    );
    const newDates = listRecurrenceDates(
      newDate,
      afterRecurrence.type,
      afterRecurrence.type === "CUSTOM" ? "" : afterRecurrence.until || newDate,
      afterRecurrence,
    );

    for (const from of exceptDates) {
      const idx = oldDates.indexOf(from);
      if (idx >= 0 && newDates[idx]) {
        mappedExceptions.push({ from, to: newDates[idx] });
      } else {
        mappedExceptions.push({ from, to: from });
      }
    }
  }

  return {
    beforePattern,
    afterPattern,
    patternChanged,
    beforeSampleDates,
    afterSampleDates,
    mappedExceptions,
  };
}
