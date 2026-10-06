import "server-only";
import { z } from "zod";
import {
  appendSheetRow,
  deleteSheetRowByIndex,
  findRowIndexById,
  getSheetMeta,
  getSheetRowsCanonical,
  updateSheetRowById,
  type SheetRow,
} from "@/lib/sheets/repository";
import { SHEET_HEADERS, SHEET_TABS } from "@/lib/sheets/tabs";
import type { Space, SpaceGeometry } from "@/types/space";

const spaceRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  floor: z.string().optional().default(""),
  capacity: z.coerce.number().optional().default(0),
  minCapacity: z.coerce.number().optional().default(1),
  geometryJson: z.string().optional().default(""),
  mapId: z.string().optional().default(""),
  active: z
    .string()
    .optional()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
});

function parseGeometry(raw: string): SpaceGeometry | null {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as SpaceGeometry;
  } catch {
    return null;
  }
}

function spaceToRow(space: Space): string[] {
  return [
    space.id,
    space.name,
    space.floor,
    String(space.capacity),
    space.geometry ? JSON.stringify(space.geometry) : "",
    space.mapId,
    space.active ? "true" : "false",
    String(space.minCapacity > 0 ? space.minCapacity : 1),
  ];
}

/** Filas de 7 columnas leídas con minCapacity en medio (desplaza geometryJson). */
function remapLegacyMisalignedSpaceRow(row: SheetRow): SheetRow {
  const minRaw = row.minCapacity?.trim() ?? "";
  const geoRaw = row.geometryJson?.trim() ?? "";
  if (!minRaw.startsWith("{")) return row;
  if (geoRaw.startsWith("{")) return row;

  return {
    ...row,
    minCapacity: "",
    geometryJson: minRaw,
    mapId: geoRaw,
    active: row.mapId?.trim() ?? row.active,
  };
}

export async function getAllSpaces(): Promise<Space[]> {
  const { rows } = await getSheetRowsCanonical(SHEET_TABS.ESPACIOS);
  const spaces: Space[] = [];

  for (const row of rows) {
    if (!row.id?.trim()) continue;
    const normalized = remapLegacyMisalignedSpaceRow(row);
    const parsed = spaceRowSchema.safeParse(normalized);
    if (!parsed.success) {
      console.warn(
        `[sheets] Fila de espacio ignorada (${row.id ?? "sin id"}):`,
        parsed.error.flatten().fieldErrors,
      );
      continue;
    }
    spaces.push({
      id: parsed.data.id,
      name: parsed.data.name,
      floor: parsed.data.floor,
      capacity: parsed.data.capacity,
      minCapacity:
        parsed.data.minCapacity > 0 ? parsed.data.minCapacity : 1,
      geometry: parseGeometry(parsed.data.geometryJson),
      mapId: parsed.data.mapId,
      active: parsed.data.active,
    });
  }

  return spaces;
}

export async function getSpacesByMapId(mapId: string): Promise<Space[]> {
  return (await getAllSpaces()).filter((space) => space.mapId === mapId);
}

export async function getSpaceById(id: string): Promise<Space | null> {
  const spaces = await getAllSpaces();
  return spaces.find((space) => space.id === id) ?? null;
}

export async function createSpace(
  input: Omit<Space, "id"> & { id?: string },
): Promise<Space> {
  const space: Space = {
    id: input.id ?? "",
    name: input.name,
    floor: input.floor,
    capacity: input.capacity,
    minCapacity: input.minCapacity > 0 ? input.minCapacity : 1,
    geometry: input.geometry,
    mapId: input.mapId,
    active: input.active,
  };

  if (!space.id) {
    const { createId } = await import("@/lib/id");
    space.id = createId("space");
  }

  await appendSheetRow(SHEET_TABS.ESPACIOS, spaceToRow(space));
  return space;
}

export async function updateSpace(
  id: string,
  input: Partial<Omit<Space, "id">>,
): Promise<Space | null> {
  const existing = await getSpaceById(id);
  if (!existing) return null;

  const updated: Space = {
    ...existing,
    ...input,
    id,
  };

  const ok = await updateSheetRowById(
    SHEET_TABS.ESPACIOS,
    id,
    spaceToRow(updated),
  );
  return ok ? updated : null;
}

export async function deleteSpace(id: string): Promise<boolean> {
  const rowIndex = await findRowIndexById(SHEET_TABS.ESPACIOS, id);
  if (!rowIndex) return false;

  const { sheetId } = await getSheetMeta(SHEET_TABS.ESPACIOS);
  await deleteSheetRowByIndex(SHEET_TABS.ESPACIOS, rowIndex, sheetId);
  return true;
}

export function validateSpaceHeaders(): string[] {
  return SHEET_HEADERS.Espacios;
}
