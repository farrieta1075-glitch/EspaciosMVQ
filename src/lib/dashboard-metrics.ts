import "server-only";
import { getAllAreas } from "@/lib/sheets/areas";
import { getAllUserRecords } from "@/lib/sheets/users";
import { getAllReservations, getAllReservationResources } from "@/lib/sheets/reservations";
import { getAllResources } from "@/lib/sheets/resources";
import { getAllSpaces } from "@/lib/sheets/spaces";
import { getSheetRows } from "@/lib/sheets/repository";
import { SHEET_TABS } from "@/lib/sheets/tabs";

export interface DashboardStats {
  summary: {
    totalReservations: number;
    confirmedReservations: number;
    cancelledReservations: number;
    activeSpaces: number;
    activeResources: number;
    activeUsers: number;
    totalUsers: number;
  };
  reservationsBySpace: { name: string; count: number; hours: number }[];
  reservationsByArea: { name: string; count: number }[];
  reservationsByUser: { name: string; count: number }[];
  resourceUsage: { name: string; quantity: number }[];
  topEvents: { name: string; count: number }[];
  reservationsByMonth: { month: string; count: number }[];
}

function reservationHours(startAt: string, endAt: string): number {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diffMs = end.getTime() - start.getTime();
  return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
}

function monthKey(date: Date): string {
  return date.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
}

function inDateRange(
  isoDate: string,
  from?: string,
  to?: string,
): boolean {
  if (!isoDate) return false;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;
  if (from) {
    const fromDate = new Date(`${from}T00:00:00`);
    if (date < fromDate) return false;
  }
  if (to) {
    const toDate = new Date(`${to}T23:59:59`);
    if (date > toDate) return false;
  }
  return true;
}

export async function getDashboardStats(options?: {
  from?: string;
  to?: string;
}): Promise<DashboardStats> {
  const from = options?.from;
  const to = options?.to;

  const [
    reservations,
    reservationResources,
    spaces,
    resources,
    users,
    areas,
    historyRows,
  ] = await Promise.all([
    getAllReservations(),
    getAllReservationResources(),
    getAllSpaces(),
    getAllResources(),
    getAllUserRecords(),
    getAllAreas(),
    getSheetRows(SHEET_TABS.EVENTO_HISTORICO).then(({ rows }) => rows),
  ]);

  const filtered = reservations.filter((reservation) =>
    inDateRange(reservation.startAt, from, to),
  );

  const spaceMap = new Map(spaces.map((space) => [space.id, space.name]));
  const areaMap = new Map(areas.map((area) => [area.id, area.name]));
  const userMap = new Map(
    users.map((user) => [
      user.id,
      user.username ?? user.email ?? user.id,
    ]),
  );
  const resourceMap = new Map(resources.map((resource) => [resource.id, resource.name]));
  const activeReservationIds = new Set(
    filtered
      .filter((reservation) => reservation.status !== "CANCELLED")
      .map((reservation) => reservation.id),
  );

  const spaceCounts = new Map<string, { count: number; hours: number }>();
  for (const reservation of filtered) {
    if (reservation.status === "CANCELLED") continue;
    const hours = reservationHours(reservation.startAt, reservation.endAt);
    for (const spaceId of reservation.spaceIds) {
      const current = spaceCounts.get(spaceId) ?? { count: 0, hours: 0 };
      spaceCounts.set(spaceId, {
        count: current.count + 1,
        hours: current.hours + hours,
      });
    }
  }

  const areaCounts = new Map<string, number>();
  for (const reservation of filtered) {
    if (reservation.status === "CANCELLED") continue;
    const key = reservation.areaId || "sin-area";
    areaCounts.set(key, (areaCounts.get(key) ?? 0) + 1);
  }

  const userCounts = new Map<string, number>();
  for (const reservation of filtered) {
    if (reservation.status === "CANCELLED") continue;
    const key = reservation.userId || "sin-usuario";
    userCounts.set(key, (userCounts.get(key) ?? 0) + 1);
  }

  const resourceUsageMap = new Map<string, number>();
  for (const item of reservationResources) {
    if (!activeReservationIds.has(item.reservationId)) continue;
    resourceUsageMap.set(
      item.resourceId,
      (resourceUsageMap.get(item.resourceId) ?? 0) + item.quantity,
    );
  }

  const monthCounts = new Map<string, number>();
  for (const reservation of filtered) {
    if (reservation.status === "CANCELLED") continue;
    const date = new Date(reservation.startAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = monthKey(date);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  const topEventsMap = new Map<string, number>();
  for (const row of historyRows) {
    const name = row.eventName?.trim();
    if (!name) continue;
    topEventsMap.set(name, (topEventsMap.get(name) ?? 0) + (Number(row.count) || 0));
  }
  for (const reservation of filtered) {
    if (reservation.status === "CANCELLED" || !reservation.eventName) continue;
    if (!topEventsMap.has(reservation.eventName)) {
      topEventsMap.set(reservation.eventName, 1);
    }
  }

  const sortDesc = <T extends { count: number }>(items: T[]) =>
    [...items].sort((a, b) => b.count - a.count);

  return {
    summary: {
      totalReservations: filtered.length,
      confirmedReservations: filtered.filter((r) => r.status === "CONFIRMED")
        .length,
      cancelledReservations: filtered.filter((r) => r.status === "CANCELLED")
        .length,
      activeSpaces: spaces.filter((space) => space.active).length,
      activeResources: resources.filter((resource) => resource.active).length,
      activeUsers: users.filter((user) => user.active).length,
      totalUsers: users.length,
    },
    reservationsBySpace: sortDesc(
      Array.from(spaceCounts.entries()).map(([spaceId, data]) => ({
        name: spaceMap.get(spaceId) ?? spaceId,
        count: data.count,
        hours: Math.round(data.hours * 10) / 10,
      })),
    ).slice(0, 10),
    reservationsByArea: sortDesc(
      Array.from(areaCounts.entries()).map(([areaId, count]) => ({
        name:
          areaId === "sin-area"
            ? "Sin área"
            : (areaMap.get(areaId) ?? areaId),
        count,
      })),
    ),
    reservationsByUser: sortDesc(
      Array.from(userCounts.entries()).map(([userId, count]) => ({
        name:
          userId === "sin-usuario"
            ? "Sin usuario"
            : (userMap.get(userId) ?? userId),
        count,
      })),
    ).slice(0, 10),
    resourceUsage: sortDesc(
      Array.from(resourceUsageMap.entries()).map(([resourceId, quantity]) => ({
        name: resourceMap.get(resourceId) ?? resourceId,
        quantity,
        count: quantity,
      })),
    ).slice(0, 10),
    topEvents: sortDesc(
      Array.from(topEventsMap.entries()).map(([name, count]) => ({ name, count })),
    ).slice(0, 8),
    reservationsByMonth: Array.from(monthCounts.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month, "es")),
  };
}
