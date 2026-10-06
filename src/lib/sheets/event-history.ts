import "server-only";
import {
  appendSheetRow,
  findRowIndexById,
  getSheetRows,
  updateSheetRowByIndex,
} from "@/lib/sheets/repository";
import { SHEET_TABS } from "@/lib/sheets/tabs";
import type { EventSuggestion } from "@/types/reservation";
import { getAllReservations } from "@/lib/sheets/reservations";

interface HistoryRow {
  rowIndex: number;
  eventName: string;
  areaId: string;
  count: number;
  lastUsedAt: string;
}

async function getHistoryRows(): Promise<HistoryRow[]> {
  const { rows } = await getSheetRows(SHEET_TABS.EVENTO_HISTORICO);
  return rows.map((row, index) => ({
    rowIndex: index + 2,
    eventName: row.eventName ?? "",
    areaId: row.areaId ?? "",
    count: Number(row.count) || 0,
    lastUsedAt: row.lastUsedAt ?? "",
  }));
}

export async function recordEventUsage(
  eventName: string,
  areaId: string,
): Promise<void> {
  const normalized = eventName.trim();
  if (!normalized) return;

  const rows = await getHistoryRows();
  const existing = rows.find(
    (row) =>
      row.eventName.toLowerCase() === normalized.toLowerCase() &&
      row.areaId === areaId,
  );

  const now = new Date().toISOString();

  if (existing) {
    await updateSheetRowByIndex(
      SHEET_TABS.EVENTO_HISTORICO,
      existing.rowIndex,
      [
        existing.eventName,
        existing.areaId,
        String(existing.count + 1),
        now,
      ],
    );
    return;
  }

  await appendSheetRow(SHEET_TABS.EVENTO_HISTORICO, [
    normalized,
    areaId,
    "1",
    now,
  ]);
}

export async function getEventSuggestions(
  query: string,
  areaId?: string | null,
  limit = 8,
): Promise<EventSuggestion[]> {
  const q = query.trim().toLowerCase();
  const historyRows = await getHistoryRows();
  const reservationNames = (await getAllReservations()).map((r) => r.eventName);

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

export async function getAllEventNames(): Promise<string[]> {
  const history = await getHistoryRows();
  const reservations = await getAllReservations();
  const names = new Set<string>();
  for (const row of history) {
    if (row.eventName) names.add(row.eventName);
  }
  for (const reservation of reservations) {
    if (reservation.eventName) names.add(reservation.eventName);
  }
  return Array.from(names);
}
