import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import { mapDbMap } from "@/lib/db/catalog/mappers";
import type { BackgroundType, FloorMap, MapFloorId } from "@/types/space";

export async function getAllMaps(): Promise<FloorMap[]> {
  const rows = await getPrisma().floorMap.findMany();
  return rows.map(mapDbMap);
}

export async function getMapById(id: string): Promise<FloorMap | null> {
  const row = await getPrisma().floorMap.findUnique({ where: { id } });
  return row ? mapDbMap(row) : null;
}

export async function createMap(
  input: Omit<FloorMap, "id"> & { id?: string },
): Promise<FloorMap> {
  const { createId } = await import("@/lib/id");
  const row = await getPrisma().floorMap.create({
    data: {
      id: input.id ?? createId("map"),
      name: input.name,
      backgroundType: input.backgroundType,
      backgroundUrl: input.backgroundUrl,
      width: input.width,
      height: input.height,
      secondaryBackgroundType: input.secondaryBackgroundType ?? "",
      secondaryBackgroundUrl: input.secondaryBackgroundUrl ?? "",
      secondaryWidth: input.secondaryWidth ?? 0,
      secondaryHeight: input.secondaryHeight ?? 0,
      primaryFloor: input.primaryFloor ?? "1",
      floor1Label: input.floor1Label ?? "Planta baja",
      floor2Label: input.floor2Label ?? "Piso 2",
    },
  });
  return mapDbMap(row);
}

export async function updateMap(
  id: string,
  input: Partial<FloorMap>,
): Promise<FloorMap | null> {
  const existing = await getMapById(id);
  if (!existing) return null;
  const row = await getPrisma().floorMap.update({
    where: { id },
    data: {
      name: input.name ?? existing.name,
      backgroundType: input.backgroundType ?? existing.backgroundType,
      backgroundUrl: input.backgroundUrl ?? existing.backgroundUrl,
      width: input.width ?? existing.width,
      height: input.height ?? existing.height,
      secondaryBackgroundType:
        input.secondaryBackgroundType ?? existing.secondaryBackgroundType ?? "",
      secondaryBackgroundUrl:
        input.secondaryBackgroundUrl ?? existing.secondaryBackgroundUrl ?? "",
      secondaryWidth: input.secondaryWidth ?? existing.secondaryWidth ?? 0,
      secondaryHeight: input.secondaryHeight ?? existing.secondaryHeight ?? 0,
      primaryFloor: (input.primaryFloor ?? existing.primaryFloor ?? "1") as MapFloorId,
      floor1Label: input.floor1Label ?? existing.floor1Label ?? "Planta baja",
      floor2Label: input.floor2Label ?? existing.floor2Label ?? "Piso 2",
    },
  });
  return mapDbMap(row);
}

export async function deleteMap(id: string): Promise<boolean> {
  try {
    await getPrisma().floorMap.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
