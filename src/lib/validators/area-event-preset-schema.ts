import { z } from "zod";
import { normalizeAreaEventPreset } from "@/lib/event-preset-utils";
import type { AreaEventPreset } from "@/types/area-event-preset";

const recurrencePresetSchema = z.object({
  type: z.enum([
    "NONE",
    "DAILY",
    "WEEKLY",
    "BIWEEKLY",
    "MONTHLY_FIXED",
    "MONTHLY_RELATIVE",
    "CUSTOM",
  ]),
  until: z.string().optional(),
  exceptDates: z.array(z.string()).optional(),
  customDates: z.array(z.string()).optional(),
  monthlyRelative: z
    .object({
      weekday: z.number().int().min(0).max(6),
      ordinal: z.enum(["FIRST", "SECOND", "THIRD", "FOURTH", "LAST"]),
    })
    .optional(),
});

export const areaEventPresetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  estimatedAttendees: z.number().int().positive().optional(),
  recurrence: recurrencePresetSchema.optional(),
});

function normalizePresetList(items: unknown[]): AreaEventPreset[] {
  const out: AreaEventPreset[] = [];
  for (const item of items) {
    const preset = normalizeAreaEventPreset(item);
    if (preset) out.push(preset);
  }
  return out;
}

export const areaEventPresetsInputSchema = z
  .array(z.union([z.string(), areaEventPresetSchema]))
  .transform((items) => normalizePresetList(items));

export const areaEventPresetsFieldSchema =
  areaEventPresetsInputSchema.optional().default([]);
