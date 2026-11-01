import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import type { EventSuggestion } from "@/types/reservation";
import { getAllReservationsSql } from "@/lib/db/reservations";

export interface EventHistoryRow {
  eventName: string;
  areaId: string;
  count: number;
  lastUsedAt: string;
}

export async function getEventHistoryRowsSql(): Promise<EventHistoryRow[]> {
  const rows = await getPrisma().eventHistory.findMany();
  return rows.map((row) => ({
    eventName: row.eventName,
    areaId: row.areaId,
    count: row.count,
    lastUsedAt: row.lastUsedAt,
  }));
}

export async function recordEventUsageSql(
  eventName: string,
  areaId: string,
): Promise<void> {
  const normalized = eventName.trim();
  if (!normalized) return;

  const prisma = getPrisma();
  const rows = await prisma.eventHistory.findMany({ where: { areaId } });
  const existing = rows.find(
    (row) => row.eventName.toLowerCase() === normalized.toLowerCase(),
  );
  const now = new Date().toISOString();

  if (existing) {
    await prisma.eventHistory.update({
      where: {
        eventName_areaId: {
          eventName: existing.eventName,
          areaId: existing.areaId,
        },
      },
      data: {
        count: existing.count + 1,
        lastUsedAt: now,
      },
    });
    return;
  }

  await prisma.eventHistory.create({
    data: {
      eventName: normalized,
      areaId,
      count: 1,
      lastUsedAt: now,
    },
  });
}

export async function getEventSuggestionsSql(
  query: string,
  areaId?: string | null,
  limit = 8,
): Promise<EventSuggestion[]> {
  const q = query.trim().toLowerCase();
  const historyRows = await getEventHistoryRowsSql();
  const reservationNames = (await getAllReservationsSql()).map((r) => r.eventName);

  const uniqueNames = new Map<string, EventSuggestion>();

  for (const row of historyRows) {
    if (!row.eventName) continue;
    if (q && !row.eventName.toLowerCase().includes(q)) continue;

    uniqueNames.set(`${row.eventName}::${row.areaId}`, {
      eventName: row.eventName,
      areaId: row.areaId,
      count: row.count,
      priority: row.areaId === areaId ? 2 : 1,
    });
  }

  for (const name of reservationNames) {
    if (!name) continue;
    if (q && !name.toLowerCase().includes(q)) continue;
    const key = `${name}::`;
    if (!uniqueNames.has(key)) {
      uniqueNames.set(key, {
        eventName: name,
        areaId: "",
        count: 1,
        priority: 0,
      });
    }
  }

  return Array.from(uniqueNames.values())
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.count !== a.count) return b.count - a.count;
      return a.eventName.localeCompare(b.eventName, "es");
    })
    .slice(0, limit);
}

export async function getAllEventNamesSql(): Promise<string[]> {
  const history = await getEventHistoryRowsSql();
  const reservations = await getAllReservationsSql();
  const names = new Set<string>();
  for (const row of history) {
    if (row.eventName) names.add(row.eventName);
  }
  for (const reservation of reservations) {
    if (reservation.eventName) names.add(reservation.eventName);
  }
  return Array.from(names);
}
