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
import { getResourceSpaceLinks, setResourceSpaceLinks } from "@/lib/sheets/resource-spaces";
import { SHEET_TABS } from "@/lib/sheets/tabs";
import type { Resource, ResourceScope, ResourceType } from "@/types/resource";

const resourceRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["TECNICO", "CONSUMIBLE", "OTRO"]),
  totalQty: z.coerce.number().optional().default(0),
  imageUrl: z.string().optional().default(""),
  scope: z.enum(["GLOBAL", "RESTRICTED"]).optional().default("GLOBAL"),
  active: z
    .string()
    .optional()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
});

function resourceToRow(resource: Omit<Resource, "restrictedSpaceIds">): string[] {
  return [
    resource.id,
    resource.name,
    resource.type,
    String(resource.totalQty),
    resource.imageUrl,
    resource.scope,
    resource.active ? "true" : "false",
  ];
}

async function buildResourcesWithRestrictions(): Promise<Resource[]> {
  const { rows } = await getSheetRows(SHEET_TABS.RECURSOS);
  const links = await getResourceSpaceLinks();

  const resources: Resource[] = [];

  for (const row of rows) {
    if (!row.id?.trim()) continue;
    const parsed = resourceRowSchema.safeParse(row);
    if (!parsed.success) {
      console.warn(
        `[sheets] Fila de recurso ignorada (${row.id ?? "sin id"}):`,
        parsed.error.flatten().fieldErrors,
      );
      continue;
    }
    const restrictedSpaceIds = links
      .filter((link) => link.resourceId === parsed.data.id)
      .map((link) => link.spaceId);
    resources.push({
      id: parsed.data.id,
      name: parsed.data.name,
      type: parsed.data.type as ResourceType,
      totalQty: parsed.data.totalQty,
      imageUrl: parsed.data.imageUrl,
      scope: parsed.data.scope as ResourceScope,
      active: parsed.data.active,
      restrictedSpaceIds,
    });
  }

  return resources;
}

export async function getAllResources(): Promise<Resource[]> {
  return buildResourcesWithRestrictions();
}

export async function getResourceById(id: string): Promise<Resource | null> {
  const resources = await getAllResources();
  return resources.find((resource) => resource.id === id) ?? null;
}

export async function getResourcesByType(type: ResourceType): Promise<Resource[]> {
  return (await getAllResources()).filter((resource) => resource.type === type);
}

export async function createResource(
  input: Omit<Resource, "id" | "restrictedSpaceIds"> & {
    id?: string;
    restrictedSpaceIds?: string[];
  },
): Promise<Resource> {
  const resource: Omit<Resource, "restrictedSpaceIds"> = {
    id: input.id ?? "",
    name: input.name,
    type: input.type,
    totalQty: input.totalQty,
    imageUrl: input.imageUrl,
    scope: input.scope,
    active: input.active,
  };

  if (!resource.id) {
    const { createId } = await import("@/lib/id");
    resource.id = createId("res");
  }

  await appendSheetRow(SHEET_TABS.RECURSOS, resourceToRow(resource));

  const restrictedSpaceIds =
    resource.scope === "RESTRICTED" ? (input.restrictedSpaceIds ?? []) : [];

  if (restrictedSpaceIds.length > 0) {
    await setResourceSpaceLinks(resource.id, restrictedSpaceIds);
  }

  return { ...resource, restrictedSpaceIds };
}

export async function updateResource(
  id: string,
  input: Partial<Omit<Resource, "id">>,
): Promise<Resource | null> {
  const existing = await getResourceById(id);
  if (!existing) return null;

  const updated: Resource = {
    ...existing,
    ...input,
    id,
    restrictedSpaceIds:
      input.restrictedSpaceIds ??
      (input.scope === "GLOBAL" ? [] : existing.restrictedSpaceIds),
  };

  if (updated.scope === "GLOBAL") {
    updated.restrictedSpaceIds = [];
  }

  const ok = await updateSheetRowById(
    SHEET_TABS.RECURSOS,
    id,
    resourceToRow(updated),
  );

  if (!ok) return null;

  await setResourceSpaceLinks(id, updated.restrictedSpaceIds);
  return updated;
}

export async function deleteResource(id: string): Promise<boolean> {
  const rowIndex = await findRowIndexById(SHEET_TABS.RECURSOS, id);
  if (!rowIndex) return false;

  const { sheetId } = await getSheetMeta(SHEET_TABS.RECURSOS);
  await deleteSheetRowByIndex(SHEET_TABS.RECURSOS, rowIndex, sheetId);
  await setResourceSpaceLinks(id, []);
  return true;
}
