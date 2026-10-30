import "server-only";
import { formatDateISO, formatTimeDisplay, parseReservationDateTime } from "@/lib/date-utils";
import {
  createNotification,
  getEventReminderReservationIds,
} from "@/lib/sheets/notifications";
import { getActiveReservations } from "@/lib/sheets/reservations";
import { getAllSpaces } from "@/lib/sheets/spaces";

function tomorrowDateIso(now = new Date()): string {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  return formatDateISO(next);
}

function buildReminderMessage(input: {
  spaceNames: string[];
  estimatedAttendees: number;
  startAt: string;
  endAt: string;
}): string {
  const spacesText =
    input.spaceNames.length === 0
      ? "espacio reservado"
      : input.spaceNames.length === 1
        ? input.spaceNames[0]
        : `${input.spaceNames.slice(0, -1).join(", ")} y ${input.spaceNames.at(-1)}`;

  const start = parseReservationDateTime(input.startAt);
  const end = parseReservationDateTime(input.endAt);
  const startLabel = start ? formatTimeDisplay(start) : "—";
  const endLabel = end ? formatTimeDisplay(end) : "—";
  const attendees =
    input.estimatedAttendees > 0 ? String(input.estimatedAttendees) : "—";

  return `Te recordamos que tienes reservado(s) ${spacesText} para el día de mañana con un estimado de ${attendees} asistentes de las ${startLabel} a las ${endLabel}. Gracias.`;
}

export async function runEventReminderJob(now = new Date()): Promise<{
  created: number;
  skipped: number;
}> {
  const targetDate = tomorrowDateIso(now);
  const [reservations, spaces, reminderSent] = await Promise.all([
    getActiveReservations(),
    getAllSpaces(),
    getEventReminderReservationIds(),
  ]);
  const spaceMap = new Map(spaces.map((space) => [space.id, space.name]));

  let created = 0;
  let skipped = 0;

  for (const reservation of reservations) {
    if (reservation.status !== "CONFIRMED") continue;
    if (reservation.sendEventReminder === false) continue;
    if (!reservation.userId?.trim()) continue;

    const start = parseReservationDateTime(reservation.startAt);
    if (!start) continue;
    if (formatDateISO(start) !== targetDate) continue;

    if (reminderSent.has(reservation.id)) {
      skipped += 1;
      continue;
    }

    const spaceNames = reservation.spaceIds
      .map((id) => spaceMap.get(id) ?? id)
      .filter(Boolean);

    await createNotification({
      userId: reservation.userId,
      areaId: reservation.areaId,
      reservationId: reservation.id,
      type: "EVENT_REMINDER",
      message: buildReminderMessage({
        spaceNames,
        estimatedAttendees: reservation.estimatedAttendees,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
      }),
    });
    created += 1;
  }

  return { created, skipped };
}
