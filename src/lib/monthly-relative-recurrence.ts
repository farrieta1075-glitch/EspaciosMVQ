import { formatDateISO } from "@/lib/date-utils";

const WEEKDAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

export type MonthlyRelativeOrdinal =
  | "FIRST"
  | "SECOND"
  | "THIRD"
  | "FOURTH"
  | "LAST";

export interface MonthlyRelativeChoice {
  weekday: number;
  ordinal: MonthlyRelativeOrdinal;
}

export function weekdayNameEs(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "día";
}

/** Cuántas veces aparece ese día de la semana en el mes de `dateIso`. */
export function countWeekdayInMonth(dateIso: string, weekday: number): number {
  const [y, m] = dateIso.split("-").map(Number);
  if (!y || !m) return 0;
  let count = 0;
  const cursor = new Date(y, m - 1, 1);
  while (cursor.getMonth() === m - 1) {
    if (cursor.getDay() === weekday) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** 1-based índice del weekday en el mes (ej. 4.º viernes). */
export function weekdayOccurrenceIndexInMonth(
  dateIso: string,
  weekday: number,
): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  if (!y || !m || !d) return 1;
  let index = 0;
  for (let day = 1; day <= d; day++) {
    const dt = new Date(y, m - 1, day);
    if (dt.getDay() === weekday) index += 1;
  }
  return index || 1;
}

export function ordinalFromIndex(index: number, totalInMonth: number): MonthlyRelativeOrdinal {
  if (index >= totalInMonth) return "LAST";
  if (index === 1) return "FIRST";
  if (index === 2) return "SECOND";
  if (index === 3) return "THIRD";
  return "FOURTH";
}

export function indexFromOrdinal(ordinal: MonthlyRelativeOrdinal): number {
  switch (ordinal) {
    case "FIRST":
      return 1;
    case "SECOND":
      return 2;
    case "THIRD":
      return 3;
    case "FOURTH":
      return 4;
    default:
      return -1;
  }
}

/** Semana del mes (1–5) según el día del calendario: 1–7 → 1, 8–14 → 2, etc. */
export function weekOfMonthByDay(dateIso: string): number {
  const d = new Date(`${dateIso}T12:00:00`).getDate();
  return Math.ceil(d / 7);
}

/** Cuarta o quinta semana del mes → confirmar cuarta semana vs último weekday. */
export function needsFourthVsLastPrompt(dateIso: string): boolean {
  const week = weekOfMonthByDay(dateIso);
  return week === 4 || week === 5;
}

export function inferMonthlyRelativeFromDate(dateIso: string): MonthlyRelativeChoice {
  const date = new Date(`${dateIso}T12:00:00`);
  const weekday = date.getDay();
  const total = countWeekdayInMonth(dateIso, weekday);
  const index = weekdayOccurrenceIndexInMonth(dateIso, weekday);
  if (index === total) {
    return { weekday, ordinal: "LAST" };
  }
  return { weekday, ordinal: ordinalFromIndex(index, total) };
}

export function dateForMonthlyRelativeInMonth(
  year: number,
  monthIndex0: number,
  choice: MonthlyRelativeChoice,
): string | null {
  const weekday = choice.weekday;
  const days: Date[] = [];
  const cursor = new Date(year, monthIndex0, 1);
  while (cursor.getMonth() === monthIndex0) {
    if (cursor.getDay() === weekday) {
      days.push(new Date(cursor.getTime()));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (days.length === 0) return null;

  let pick: Date | undefined;
  if (choice.ordinal === "LAST") {
    pick = days[days.length - 1];
  } else {
    const idx = indexFromOrdinal(choice.ordinal) - 1;
    pick = days[idx];
  }
  return pick ? formatDateISO(pick) : null;
}
