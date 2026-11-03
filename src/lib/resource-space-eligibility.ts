import type { Resource } from "@/types/resource";

export function isResourceEligibleForSpaces(
  resource: Pick<Resource, "scope" | "restrictedSpaceIds">,
  selectedSpaceIds: string[],
): boolean {
  if (selectedSpaceIds.length === 0) return false;
  if (resource.scope === "GLOBAL") return true;
  return resource.restrictedSpaceIds.some((spaceId) =>
    selectedSpaceIds.includes(spaceId),
  );
}

export function findIneligibleSelectedResources(
  selectedResources: Record<string, number>,
  selectedSpaceIds: string[],
  catalog: Pick<Resource, "id" | "name" | "scope" | "restrictedSpaceIds">[],
): { id: string; name: string }[] {
  const removed: { id: string; name: string }[] = [];
  for (const [resourceId, quantity] of Object.entries(selectedResources)) {
    if (quantity <= 0) continue;
    const resource = catalog.find((item) => item.id === resourceId);
    if (!resource) {
      removed.push({ id: resourceId, name: resourceId });
      continue;
    }
    if (!isResourceEligibleForSpaces(resource, selectedSpaceIds)) {
      removed.push({ id: resourceId, name: resource.name });
    }
  }
  return removed;
}
