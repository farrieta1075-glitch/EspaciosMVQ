import "server-only";
import { getAllReservations } from "@/lib/sheets/reservations";

function spaceIdsKey(spaceIds: string[]): string {
  return [...spaceIds].sort().join(",");
}

type Occurrence = { startAt: string; endAt: string };

/**
 * Si el cliente reenvía el mismo POST (p. ej. iOS corta la respuesta),
 * devuelve el lote ya creado en lugar de insertar de nuevo.
 */
export async function findExistingReservationBatchDuplicate(input: {
  userId: string;
  eventName: string;
  spaceIds: string[];
  occurrences: Occurrence[];
}): Promise<{ ids: string[]; count: number; pending: boolean } | null> {
  if (input.occurrences.length === 0) return null;

  const all = await getAllReservations();
  const spaceKey = spaceIdsKey(input.spaceIds);
  const matches = all.filter(
    (item) =>
      item.userId === input.userId &&
      item.eventName.trim() === input.eventName.trim() &&
      spaceIdsKey(item.spaceIds) === spaceKey &&
      item.status !== "CANCELLED",
  );

  if (matches.length === 0) return null;

  const matchedIds: string[] = [];
  for (const occurrence of input.occurrences) {
    const hit = matches.find(
      (item) =>
        item.startAt === occurrence.startAt &&
        item.endAt === occurrence.endAt,
    );
    if (!hit) return null;
    matchedIds.push(hit.id);
  }

  return {
    ids: matchedIds,
    count: matchedIds.length,
    pending: matches.some((item) => item.status === "PENDING"),
  };
}
