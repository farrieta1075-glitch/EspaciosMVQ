import type { Space } from "@/types/space";

export function isCommonSpace(space: Pick<Space, "isCommon">): boolean {
  return space.isCommon !== false;
}

export function visibleSpacesForMap(
  spaces: Space[],
  options: { showAllSpaces: boolean; reservedSpaceIds: Iterable<string> },
): Space[] {
  if (options.showAllSpaces) return spaces;
  const reserved = new Set(options.reservedSpaceIds);
  return spaces.filter(
    (space) => isCommonSpace(space) || reserved.has(space.id),
  );
}
