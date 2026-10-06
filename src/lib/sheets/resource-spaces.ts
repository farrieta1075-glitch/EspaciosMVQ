import "server-only";
import {
  appendSheetRow,
  deleteSheetRowByIndex,
  getSheetMeta,
  getSheetRows,
} from "@/lib/sheets/repository";
import { SHEET_TABS } from "@/lib/sheets/tabs";

export interface ResourceSpaceLink {
  resourceId: string;
  spaceId: string;
}

export async function getResourceSpaceLinks(): Promise<ResourceSpaceLink[]> {
  const { rows } = await getSheetRows(SHEET_TABS.RECURSO_ESPACIO);
  return rows
    .filter((row) => row.resourceId && row.spaceId)
    .map((row) => ({
      resourceId: row.resourceId,
      spaceId: row.spaceId,
    }));
}

export async function getSpaceIdsForResource(resourceId: string): Promise<string[]> {
  const links = await getResourceSpaceLinks();
  return links
    .filter((link) => link.resourceId === resourceId)
    .map((link) => link.spaceId);
}

export async function setResourceSpaceLinks(
  resourceId: string,
  spaceIds: string[],
): Promise<void> {
  const { rows } = await getSheetRows(SHEET_TABS.RECURSO_ESPACIO);
  const { sheetId } = await getSheetMeta(SHEET_TABS.RECURSO_ESPACIO);

  const indicesToDelete = rows
    .map((row, index) => ({ row, index: index + 2 }))
    .filter(({ row }) => row.resourceId === resourceId)
    .map(({ index }) => index)
    .sort((a, b) => b - a);

  for (const rowIndex of indicesToDelete) {
    await deleteSheetRowByIndex(
      SHEET_TABS.RECURSO_ESPACIO,
      rowIndex,
      sheetId,
    );
  }

  for (const spaceId of spaceIds) {
    await appendSheetRow(SHEET_TABS.RECURSO_ESPACIO, [resourceId, spaceId]);
  }
}
