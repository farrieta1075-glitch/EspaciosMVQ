import "server-only";
import { z } from "zod";
import { getSheetRows } from "@/lib/sheets/repository";
import { SHEET_TABS } from "@/lib/sheets/tabs";
import type { Area } from "@/types/area";

const areaRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional().default(""),
});

export async function getAllAreas(): Promise<Area[]> {
  const { rows } = await getSheetRows(SHEET_TABS.AREAS);
  return rows.map((row) => areaRowSchema.parse(row));
}

export async function getAreaById(id: string): Promise<Area | null> {
  return (await getAllAreas()).find((area) => area.id === id) ?? null;
}
