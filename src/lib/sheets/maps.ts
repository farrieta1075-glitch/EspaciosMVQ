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
import { isCatalogOnSql } from "@/lib/db/config";
import { SHEET_TABS } from "@/lib/sheets/tabs";
import type { BackgroundType, FloorMap, MapFloorId } from "@/types/space";

const mapRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  backgroundType: z.enum(["blank", "image", "pdf"]),
  backgroundUrl: z.string().optional().default(""),
  width: z.coerce.number().optional().default(800),
  height: z.coerce.number().optional().default(600),
});

function floorMapToRow(map: FloorMap): string[] {
  return [
    map.id,
    map.name,
    map.backgroundType,
    map.backgroundUrl,
    String(map.width),
    String(map.height),
    map.secondaryBackgroundType ?? "",
    map.secondaryBackgroundUrl ?? "",
    String(map.secondaryWidth ?? 0),
    String(map.secondaryHeight ?? 0),
    (map.primaryFloor ?? "1") as MapFloorId,
    map.floor1Label ?? "Planta baja",
    map.floor2Label ?? "Piso 2",
  ];
}

export async function getAllMaps(): Promise<FloorMap[]> {
  if (isCatalogOnSql()) {
    const catalog = await import("@/lib/db/catalog/maps");
    return catalog.getAllMaps();
  }
  const { rows } = await getSheetRows(SHEET_TABS.MAPAS);
  const maps: FloorMap[] = [];

  for (const row of rows) {
    if (!row.id?.trim()) continue;
    const parsed = mapRowSchema.safeParse(row);
    if (!parsed.success) {
      console.warn(
        `[sheets] Fila de mapa ignorada (${row.id ?? "sin id"}):`,
        parsed.error.flatten().fieldErrors,
      );
      continue;
    }
    maps.push({
      id: parsed.data.id,
      name: parsed.data.name,
      backgroundType: parsed.data.backgroundType as BackgroundType,
      backgroundUrl: parsed.data.backgroundUrl,
      width: parsed.data.width,
      height: parsed.data.height,
      secondaryBackgroundType: (row.secondaryBackgroundType ||
        undefined) as BackgroundType | undefined,
      secondaryBackgroundUrl: row.secondaryBackgroundUrl || undefined,
      secondaryWidth: row.secondaryWidth ? Number(row.secondaryWidth) : undefined,
      secondaryHeight: row.secondaryHeight ? Number(row.secondaryHeight) : undefined,
      primaryFloor: row.primaryFloor === "2" ? "2" : "1",
      floor1Label: row.floor1Label || undefined,
      floor2Label: row.floor2Label || undefined,
    });
  }

  return maps;
}

export async function getMapById(id: string): Promise<FloorMap | null> {
  if (isCatalogOnSql()) {
    const catalog = await import("@/lib/db/catalog/maps");
    return catalog.getMapById(id);
  }
  const maps = await getAllMaps();
  return maps.find((map) => map.id === id) ?? null;
}

export async function createMap(
  input: Omit<FloorMap, "id"> & { id?: string },
): Promise<FloorMap> {
  if (isCatalogOnSql()) {
    const catalog = await import("@/lib/db/catalog/maps");
    return catalog.createMap(input);
  }
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
  if (isCatalogOnSql()) {
    const catalog = await import("@/lib/db/catalog/maps");
    return catalog.updateMap(id, input);
  }
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
  if (isCatalogOnSql()) {
    const catalog = await import("@/lib/db/catalog/maps");
    return catalog.deleteMap(id);
  }
  const rowIndex = await findRowIndexById(SHEET_TABS.MAPAS, id);
  if (!rowIndex) return false;

  const { sheetId } = await getSheetMeta(SHEET_TABS.MAPAS);
  await deleteSheetRowByIndex(SHEET_TABS.MAPAS, rowIndex, sheetId);
  return true;
}
