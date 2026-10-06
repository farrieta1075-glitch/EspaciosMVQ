import "server-only";
import { z } from "zod";
import {
  appendSheetRow,
  deleteSheetRowByIndex,
  findRowIndexById,
  getSheetMeta,
  getSheetRows,
  updateSheetRowById,
} from "@/lib/sheets/repository";
import { SHEET_TABS } from "@/lib/sheets/tabs";
import type { BackgroundType, FloorMap } from "@/types/space";

const mapRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  backgroundType: z.enum(["blank", "image", "pdf"]),
  backgroundUrl: z.string().optional().default(""),
  width: z.coerce.number().optional().default(800),
  height: z.coerce.number().optional().default(600),
});

function mapRowToFloorMap(row: Record<string, string>): FloorMap {
  const parsed = mapRowSchema.parse(row);
  return {
    id: parsed.id,
    name: parsed.name,
    backgroundType: parsed.backgroundType as BackgroundType,
    backgroundUrl: parsed.backgroundUrl,
    width: parsed.width,
    height: parsed.height,
  };
}

function floorMapToRow(map: FloorMap): string[] {
  return [
    map.id,
    map.name,
    map.backgroundType,
    map.backgroundUrl,
    String(map.width),
    String(map.height),
  ];
}

export async function getAllMaps(): Promise<FloorMap[]> {
  const { rows } = await getSheetRows(SHEET_TABS.MAPAS);
  return rows.map(mapRowToFloorMap);
}

export async function getMapById(id: string): Promise<FloorMap | null> {
  const maps = await getAllMaps();
  return maps.find((map) => map.id === id) ?? null;
}

export async function createMap(
  input: Omit<FloorMap, "id"> & { id?: string },
): Promise<FloorMap> {
  const map: FloorMap = {
    id: input.id ?? "",
    name: input.name,
    backgroundType: input.backgroundType,
    backgroundUrl: input.backgroundUrl,
    width: input.width,
    height: input.height,
  };

  if (!map.id) {
    const { createId } = await import("@/lib/id");
    map.id = createId("map");
  }

  await appendSheetRow(SHEET_TABS.MAPAS, floorMapToRow(map));
  return map;
}

export async function updateMap(
  id: string,
  input: Partial<Omit<FloorMap, "id">>,
): Promise<FloorMap | null> {
  const existing = await getMapById(id);
  if (!existing) return null;

  const updated: FloorMap = { ...existing, ...input, id };
  const ok = await updateSheetRowById(
    SHEET_TABS.MAPAS,
    id,
    floorMapToRow(updated),
  );
  return ok ? updated : null;
}

export async function deleteMap(id: string): Promise<boolean> {
  const rowIndex = await findRowIndexById(SHEET_TABS.MAPAS, id);
  if (!rowIndex) return false;

  const { sheetId } = await getSheetMeta(SHEET_TABS.MAPAS);
  await deleteSheetRowByIndex(SHEET_TABS.MAPAS, rowIndex, sheetId);
  return true;
}
