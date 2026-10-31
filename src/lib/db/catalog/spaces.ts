import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import { mapDbSpace } from "@/lib/db/catalog/mappers";
import type { Space } from "@/types/space";

function geometryJson(space: Pick<Space, "geometry">): string {
  return space.geometry ? JSON.stringify(space.geometry) : "";
}

export async function getAllSpaces(): Promise<Space[]> {
  const rows = await getPrisma().space.findMany();
  return rows.map(mapDbSpace);
}

export async function getSpacesByMapId(mapId: string): Promise<Space[]> {
  const rows = await getPrisma().space.findMany({ where: { mapId } });
  return rows.map(mapDbSpace);
}

export async function getSpaceById(id: string): Promise<Space | null> {
  const row = await getPrisma().space.findUnique({ where: { id } });
  return row ? mapDbSpace(row) : null;
}

export async function createSpace(
  input: Omit<Space, "id"> & { id?: string },
): Promise<Space> {
  const { createId } = await import("@/lib/id");
  const row = await getPrisma().space.create({
    data: {
      id: input.id ?? createId("space"),
      name: input.name,
      floor: input.floor?.trim() || "1",
      capacity: input.capacity,
      minCapacity: input.minCapacity > 0 ? input.minCapacity : 1,
      geometryJson: geometryJson(input),
      mapId: input.mapId,
      active: input.active,
    },
  });
  return mapDbSpace(row);
}

export async function updateSpace(
  id: string,
  input: Partial<Space>,
): Promise<Space | null> {
  const existing = await getSpaceById(id);
  if (!existing) return null;
  const row = await getPrisma().space.update({
    where: { id },
    data: {
      name: input.name ?? existing.name,
      floor: input.floor !== undefined ? input.floor.trim() || "1" : existing.floor,
      capacity: input.capacity ?? existing.capacity,
      minCapacity:
        input.minCapacity !== undefined
          ? input.minCapacity > 0
            ? input.minCapacity
            : 1
          : existing.minCapacity,
      geometryJson:
        input.geometry !== undefined ? geometryJson({ geometry: input.geometry }) : geometryJson(existing),
      mapId: input.mapId ?? existing.mapId,
      active: input.active ?? existing.active,
    },
  });
  return mapDbSpace(row);
}

export async function deleteSpace(id: string): Promise<boolean> {
  try {
    await getPrisma().space.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
