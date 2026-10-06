import "server-only";
import { getAllResources } from "@/lib/sheets/resources";
import { getSpacesByMapId } from "@/lib/sheets/spaces";
import {
  getActiveReservations,
  getAllReservationResources,
  parseDateTime,
  reservationsOverlap,
} from "@/lib/sheets/reservations";
import type {
  AvailabilityResponse,
  ResourceAvailability,
  SpaceAvailability,
} from "@/types/reservation";

interface AvailabilityQuery {
  date: string;
  startTime: string;
  endTime: string;
  mapId: string;
  selectedSpaceIds?: string[];
  /** Al editar una reserva, no contar su ocupación ni sus recursos reservados. */
  excludeReservationId?: string;
}

export async function getAvailability(
  query: AvailabilityQuery,
): Promise<AvailabilityResponse> {
  const rangeStart = parseDateTime(query.date, query.startTime);
  const rangeEnd = parseDateTime(query.date, query.endTime);

  const [spaces, reservations, reservationResources, resources] =
    await Promise.all([
      getSpacesByMapId(query.mapId),
      getActiveReservations(),
      getAllReservationResources(),
      getAllResources(),
    ]);

  const activeSpaceIds = new Set(
    spaces.filter((space) => space.active).map((space) => space.id),
  );

  const overlappingReservationIds = new Set<string>();

  const occupiedSpaceIds = new Set<string>();

  for (const reservation of reservations) {
    if (!reservation.startAt || !reservation.endAt) continue;
    if (
      query.excludeReservationId &&
      reservation.id === query.excludeReservationId
    ) {
      continue;
    }

    const resStart = new Date(reservation.startAt);
    const resEnd = new Date(reservation.endAt);

    if (!reservationsOverlap(rangeStart, rangeEnd, resStart, resEnd)) continue;

    overlappingReservationIds.add(reservation.id);
    for (const spaceId of reservation.spaceIds) {
      if (activeSpaceIds.has(spaceId)) {
        occupiedSpaceIds.add(spaceId);
      }
    }
  }

  const spaceAvailability: SpaceAvailability[] = spaces
    .filter((space) => space.active && space.geometry)
    .map((space) => ({
      id: space.id,
      status: occupiedSpaceIds.has(space.id) ? "occupied" : "available",
    }));

  const reservedQtyByResource = new Map<string, number>();

  for (const link of reservationResources) {
    if (!overlappingReservationIds.has(link.reservationId)) continue;
    reservedQtyByResource.set(
      link.resourceId,
      (reservedQtyByResource.get(link.resourceId) ?? 0) + link.quantity,
    );
  }

  const filterSpaceIds =
    query.selectedSpaceIds && query.selectedSpaceIds.length > 0
      ? query.selectedSpaceIds
      : spaces.map((space) => space.id);

  const resourceAvailability: ResourceAvailability[] = resources
    .filter((resource) => resource.active)
    .filter((resource) => {
      if (resource.scope === "GLOBAL") return true;
      return resource.restrictedSpaceIds.some((spaceId) =>
        filterSpaceIds.includes(spaceId),
      );
    })
    .map((resource) => {
      const reserved = reservedQtyByResource.get(resource.id) ?? 0;
      const availableQty = Math.max(resource.totalQty - reserved, 0);
      return {
        id: resource.id,
        name: resource.name,
        type: resource.type,
        imageUrl: resource.imageUrl,
        totalQty: resource.totalQty,
        availableQty,
        scope: resource.scope,
      };
    });

  return {
    spaces: spaceAvailability,
    resources: resourceAvailability,
  };
}
