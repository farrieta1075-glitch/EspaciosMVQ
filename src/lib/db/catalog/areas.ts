import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import {
  mapDbArea,
  serializeEventPresets,
} from "@/lib/db/catalog/mappers";
import type { Area } from "@/types/area";

export async function getAllAreas(): Promise<Area[]> {
  const rows = await getPrisma().area.findMany();
  return rows.map(mapDbArea);
}

export async function getAreaById(id: string): Promise<Area | null> {
  const row = await getPrisma().area.findUnique({ where: { id } });
  return row ? mapDbArea(row) : null;
}

export async function createArea(input: {
  name: string;
  code?: string;
  parentId?: string | null;
  colorHex?: string;
  eventPresets?: string[];
}): Promise<Area> {
  const { createId } = await import("@/lib/id");
  const name = input.name.trim();
  if (!name) throw new Error("El nombre del área es obligatorio.");
  const parentId = input.parentId?.trim() || null;
  if (parentId) {
    const parent = await getAreaById(parentId);
    if (!parent) throw new Error("El área padre no existe.");
  }
  const row = await getPrisma().area.create({
    data: {
      id: createId("area"),
      name,
      code: input.code?.trim() ?? "",
      parentId,
      colorHex: input.colorHex?.trim() ?? "",
      eventPresets: serializeEventPresets(input.eventPresets ?? []),
    },
  });
  return mapDbArea(row);
}

export async function updateArea(
  id: string,
  input: Partial<{
    name: string;
    code: string;
    parentId: string | null;
    colorHex: string;
    eventPresets: string[];
  }>,
): Promise<Area | null> {
  const existing = await getAreaById(id);
  if (!existing) return null;
  const parentId =
    input.parentId !== undefined
      ? input.parentId?.trim() || null
      : existing.parentId;
  if (parentId === id) throw new Error("Un área no puede ser padre de sí misma.");
  if (parentId) {
    const parent = await getAreaById(parentId);
    if (!parent) throw new Error("El área padre no existe.");
  }
  const row = await getPrisma().area.update({
    where: { id },
    data: {
      name: input.name?.trim() || existing.name,
      code: input.code !== undefined ? input.code.trim() : existing.code,
      parentId,
      colorHex:
        input.colorHex !== undefined ? input.colorHex.trim() : existing.colorHex,
      eventPresets:
        input.eventPresets !== undefined
          ? serializeEventPresets(input.eventPresets)
          : serializeEventPresets(existing.eventPresets),
    },
  });
  return mapDbArea(row);
}

export async function deleteArea(id: string): Promise<void> {
  const children = await getPrisma().area.count({ where: { parentId: id } });
  if (children > 0) {
    throw new Error("Elimina o reasigna las subáreas antes de borrar esta área.");
  }
  await getPrisma().area.delete({ where: { id } });
}
