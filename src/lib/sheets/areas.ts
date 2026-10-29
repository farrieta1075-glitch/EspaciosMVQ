import "server-only";
import { z } from "zod";
import {
  appendSheetRow,
  deleteSheetRowByIndex,
  findRowIndexById,
  getSheetMeta,
  getSheetRowsCanonical,
  updateSheetRowById,
} from "@/lib/sheets/repository";
import { parseEventPresets, serializeEventPresets } from "@/lib/area-scope";
import { SHEET_TABS } from "@/lib/sheets/tabs";
import type { Area } from "@/types/area";

const areaRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional().default(""),
  parentId: z.string().optional().default(""),
  colorHex: z.string().optional().default(""),
  eventPresets: z.string().optional().default(""),
});

function mapRowToArea(row: z.infer<typeof areaRowSchema>): Area {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? "",
    parentId: row.parentId?.trim() || null,
    colorHex: row.colorHex?.trim() || "",
    eventPresets: parseEventPresets(row.eventPresets),
  };
}

function areaToRow(area: Area): string[] {
  return [
    area.id,
    area.name,
    area.code ?? "",
    area.parentId ?? "",
    area.colorHex ?? "",
    serializeEventPresets(area.eventPresets ?? []),
  ];
}

export async function getAllAreas(): Promise<Area[]> {
  const { rows } = await getSheetRowsCanonical(SHEET_TABS.AREAS);
  const areas: Area[] = [];

  for (const row of rows) {
    if (!row.id?.trim()) continue;
    const parsed = areaRowSchema.safeParse(row);
    if (!parsed.success) {
      console.warn(
        `[sheets] Fila de área ignorada (${row.id ?? "sin id"}):`,
        parsed.error.flatten().fieldErrors,
      );
      continue;
    }
    areas.push(mapRowToArea(parsed.data));
  }

  return areas;
}

export async function getAreaById(id: string): Promise<Area | null> {
  return (await getAllAreas()).find((area) => area.id === id) ?? null;
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

  const area: Area = {
    id: createId("area"),
    name,
    code: input.code?.trim() ?? "",
    parentId,
    colorHex: input.colorHex?.trim() ?? "",
    eventPresets: input.eventPresets ?? [],
  };

  await appendSheetRow(SHEET_TABS.AREAS, areaToRow(area));

  let persisted = await getAreaById(area.id);
  if (!persisted) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    persisted = await getAreaById(area.id);
  }
  if (!persisted) {
    throw new Error(
      "El área se guardó en la hoja pero no se pudo leer. Revisa que la pestaña Areas tenga las columnas: id, name, code, parentId, colorHex, eventPresets (en ese orden, fila 1).",
    );
  }

  return persisted;
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

  if (parentId === id) {
    throw new Error("Un área no puede ser padre de sí misma.");
  }
  if (parentId) {
    const parent = await getAreaById(parentId);
    if (!parent) throw new Error("El área padre no existe.");
  }

  const updated: Area = {
    ...existing,
    name: input.name?.trim() || existing.name,
    code: input.code !== undefined ? input.code.trim() : existing.code,
    parentId,
    colorHex:
      input.colorHex !== undefined ? input.colorHex.trim() : existing.colorHex,
    eventPresets:
      input.eventPresets !== undefined
        ? input.eventPresets
        : existing.eventPresets,
  };

  const ok = await updateSheetRowById(SHEET_TABS.AREAS, id, areaToRow(updated));
  return ok ? updated : null;
}

export async function deleteArea(id: string): Promise<void> {
  const areas = await getAllAreas();
  const hasChildren = areas.some((area) => area.parentId === id);
  if (hasChildren) {
    throw new Error("Elimina o reasigna las subáreas antes de borrar esta área.");
  }

  const rowIndex = await findRowIndexById(SHEET_TABS.AREAS, id);
  if (!rowIndex) throw new Error("Área no encontrada.");

  const { sheetId } = await getSheetMeta(SHEET_TABS.AREAS);
  await deleteSheetRowByIndex(SHEET_TABS.AREAS, rowIndex, sheetId);
}
