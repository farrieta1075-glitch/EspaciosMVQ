export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

/** Ej.: Miércoles, 7 de octubre de 2026 */
export function formatDateDisplay(date: Date): string {
  const weekdayRaw = date.toLocaleDateString("es-MX", { weekday: "long" });
  const weekday =
    weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1).toLowerCase();
  const month = date
    .toLocaleDateString("es-MX", { month: "long" })
    .toLowerCase();
  const day = date.getDate();
  const year = date.getFullYear();
  return `${weekday}, ${day} de ${month} de ${year}`;
}

/** Interpreta fechas guardadas en Sheets (ISO, solo fecha, o D/M/YYYY con hora). */
export function parseReservationDateTime(value: string): Date | null {
  const raw = value?.trim();
  if (!raw) return null;

  let match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (match) {
    const hour = match[4] !== undefined ? Number(match[4]) : 0;
    const minute = match[5] !== undefined ? Number(match[5]) : 0;
    const second = match[6] !== undefined ? Number(match[6]) : 0;
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      hour,
      minute,
      second,
    );
  }

  if (/^\d{5}(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    const wholeDays = Math.floor(serial);
    const fraction = serial - wholeDays;
    const base = new Date(1899, 11, 30);
    base.setDate(base.getDate() + wholeDays);
    const minutes = Math.round(fraction * 24 * 60);
    base.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return base;
  }

  match = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (match) {
    const hour = match[4] !== undefined ? Number(match[4]) : 0;
    const minute = match[5] !== undefined ? Number(match[5]) : 0;
    const second = match[6] !== undefined ? Number(match[6]) : 0;
    return new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      hour,
      minute,
      second,
    );
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatTimeHHmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Formato legible 12 h (es-MX): 10:00 a.m. */
export function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Formato corto de fecha (es-MX): vie., 25 sep. 2025 */
export function formatDateShortDisplay(date: Date): string {
  const label = date.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Guarda en Sheets como ISO local consistente. */
export function serializeReservationDateTime(value: string): string {
  const parsed = parseReservationDateTime(value);
  if (!parsed) return value?.trim() ?? "";
  return `${formatDateISO(parsed)}T${formatTimeHHmm(parsed)}:00`;
}

export function extractEndTimeForEdit(startAt: string, endAt: string): string {
  const endParsed = parseReservationDateTime(endAt);
  if (endParsed) return formatTimeHHmm(endParsed);

  const startParsed = parseReservationDateTime(startAt);
  if (startParsed) {
    const fallback = new Date(startParsed);
    fallback.setHours(fallback.getHours() + 1);
    return formatTimeHHmm(fallback);
  }

  return "18:00";
}

export function extractDateFromIso(iso: string): string {
  const parsed = parseReservationDateTime(iso);
  if (parsed) return formatDateISO(parsed);
  if (!iso) return "";
  const head = iso.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : "";
}

export function extractTimeFromIso(iso: string): string {
  const parsed = parseReservationDateTime(iso);
  if (parsed) return formatTimeHHmm(parsed);
  const match = iso?.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
  if (match) {
    return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
  }
  return "09:00";
}

export function formatReservationDateTimeRange(
  startAt: string,
  endAt: string,
): string {
  const start = parseReservationDateTime(startAt);
  const end = parseReservationDateTime(endAt);

  if (!start && !end) {
    const fallback = [startAt, endAt].filter(Boolean).join(" – ");
    return fallback || "Fecha y horario no disponibles";
  }

  if (start && !end) {
    return `${formatDateShortDisplay(start)} · ${formatTimeDisplay(start)}`;
  }

  if (!start && end) {
    return `${formatDateShortDisplay(end)} · ${formatTimeDisplay(end)}`;
  }

  const dateLabel = formatDateShortDisplay(start!);
  const startTime = formatTimeDisplay(start!);
  const endTime = formatTimeDisplay(end!);

  const sameDay =
    start!.getFullYear() === end!.getFullYear() &&
    start!.getMonth() === end!.getMonth() &&
    start!.getDate() === end!.getDate();

  if (sameDay) {
    return `${formatDateDisplay(start!)} · ${startTime} – ${endTime}`;
  }

  const endDateLabel = formatDateShortDisplay(end!);
  return `${dateLabel} ${startTime} → ${endDateLabel} ${endTime}`;
}

export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - day);
  result.setHours(12, 0, 0, 0);
  return result;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

const MONTH_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

export function formatDayMonthShort(date: Date): string {
  return `${date.getDate()}-${MONTH_SHORT[date.getMonth()]}`;
}

export function formatMonthYear(date: Date): string {
  const label = date.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatWeekRange(anchorDate: Date): string {
  const days = getWeekDays(anchorDate);
  const start = days[0];
  const end = days[6];
  const startLabel = formatDayMonthShort(start);
  const endLabel = formatDayMonthShort(end);
  const year = end.getFullYear();

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTH_SHORT[end.getMonth()]} ${year}`;
  }

  return `${startLabel} – ${endLabel} ${year}`;
}

export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function getMonthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}
