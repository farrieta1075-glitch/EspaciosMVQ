import "server-only";
import { z } from "zod";
import {
  appendSheetRow,
  findRowIndexById,
  getSheetRows,
  updateSheetRowByIndex,
} from "@/lib/sheets/repository";
import { SHEET_TABS } from "@/lib/sheets/tabs";

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
  updatedAt: string;
}

const rowSchema = z.object({
  id: z.string().min(1),
  userId: z.string().optional().default(""),
  deviceId: z.string().optional().default(""),
  endpoint: z.string().optional().default(""),
  p256dh: z.string().optional().default(""),
  auth: z.string().optional().default(""),
  userAgent: z.string().optional().default(""),
  updatedAt: z.string().optional().default(""),
});

function mapRow(row: Record<string, string>): PushSubscriptionRecord | null {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success || !parsed.data.endpoint.trim()) return null;
  return {
    id: parsed.data.id,
    userId: parsed.data.userId.trim(),
    deviceId: parsed.data.deviceId.trim(),
    endpoint: parsed.data.endpoint.trim(),
    p256dh: parsed.data.p256dh.trim(),
    auth: parsed.data.auth.trim(),
    userAgent: parsed.data.userAgent.trim(),
    updatedAt: parsed.data.updatedAt.trim(),
  };
}

function toRow(record: PushSubscriptionRecord): string[] {
  return [
    record.id,
    record.userId,
    record.deviceId,
    record.endpoint,
    record.p256dh,
    record.auth,
    record.userAgent,
    record.updatedAt,
  ];
}

async function listAll(): Promise<PushSubscriptionRecord[]> {
  const { rows } = await getSheetRows(SHEET_TABS.PUSH_SUBSCRIPTIONS);
  return rows
    .map(mapRow)
    .filter((item): item is PushSubscriptionRecord => item !== null);
}

export async function upsertPushSubscription(input: {
  userId: string;
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<PushSubscriptionRecord> {
  const { createId } = await import("@/lib/id");
  const now = new Date().toISOString();
  const all = await listAll();

  const byEndpoint = all.find((item) => item.endpoint === input.endpoint);
  const byDevice = all.find((item) => item.deviceId === input.deviceId);

  const existing = byEndpoint ?? byDevice;
  const record: PushSubscriptionRecord = {
    id: existing?.id ?? createId("psub"),
    userId: input.userId,
    deviceId: input.deviceId,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: input.userAgent?.trim() ?? existing?.userAgent ?? "",
    updatedAt: now,
  };

  if (existing) {
    const rowIndex = await findRowIndexById(
      SHEET_TABS.PUSH_SUBSCRIPTIONS,
      existing.id,
    );
    if (rowIndex) {
      await updateSheetRowByIndex(
        SHEET_TABS.PUSH_SUBSCRIPTIONS,
        rowIndex,
        toRow(record),
      );
      return record;
    }
  }

  await appendSheetRow(SHEET_TABS.PUSH_SUBSCRIPTIONS, toRow(record));
  return record;
}

export async function getPushSubscriptionsForUser(
  userId: string,
): Promise<PushSubscriptionRecord[]> {
  if (!userId) return [];
  const all = await listAll();
  return all.filter((item) => item.userId === userId);
}

export async function removePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<boolean> {
  const all = await listAll();
  const match = all.find((item) => item.endpoint === endpoint);
  if (!match) return false;

  const rowIndex = await findRowIndexById(
    SHEET_TABS.PUSH_SUBSCRIPTIONS,
    match.id,
  );
  if (!rowIndex) return false;

  const { deleteSheetRowByIndex, getSheetMeta } = await import(
    "@/lib/sheets/repository"
  );
  const { sheetId } = await getSheetMeta(SHEET_TABS.PUSH_SUBSCRIPTIONS);
  await deleteSheetRowByIndex(
    SHEET_TABS.PUSH_SUBSCRIPTIONS,
    rowIndex,
    sheetId,
  );
  return true;
}
