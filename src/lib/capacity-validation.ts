import type { Space } from "@/types/space";

export function reservationNeedsAttendeeJustification(
  spaces: Space[],
  selectedSpaceIds: string[],
  estimatedAttendees: number,
): boolean {
  if (!Number.isFinite(estimatedAttendees) || estimatedAttendees <= 0) {
    return false;
  }

  const selected = spaces.filter((space) => selectedSpaceIds.includes(space.id));
  if (selected.length === 0) return false;

  for (const space of selected) {
    const max = space.capacity > 0 ? space.capacity : Number.POSITIVE_INFINITY;
    const min = space.minCapacity > 0 ? space.minCapacity : 1;
    if (estimatedAttendees < min || estimatedAttendees > max) {
      return true;
    }
  }

  return false;
}
