import { defaultRecurrenceUntil } from "@/lib/recurrence-default-until";
import type { AreaEventPreset } from "@/types/area-event-preset";
import type { RecurrenceConfig, RecurrenceType } from "@/types/reservation";

export function normalizeAreaEventPreset(item: unknown): AreaEventPreset | null {
  if (typeof item === "string") {
    const name = item.trim();
    return name ? { name } : null;
  }
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const name = String(record.name ?? "").trim();
  if (!name) return null;

  const description =
    typeof record.description === "string" ? record.description.trim() : undefined;

  let estimatedAttendees: number | undefined;
  if (typeof record.estimatedAttendees === "number" && record.estimatedAttendees > 0) {
    estimatedAttendees = Math.floor(record.estimatedAttendees);
  } else if (typeof record.estimatedAttendees === "string") {
    const n = Number(record.estimatedAttendees);
    if (n > 0) estimatedAttendees = Math.floor(n);
  }

  let recurrence: AreaEventPreset["recurrence"];
  if (record.recurrence && typeof record.recurrence === "object") {
    const r = record.recurrence as Record<string, unknown>;
    const type = r.type;
    if (typeof type === "string" && type.length > 0) {
      recurrence = {
        type: type as RecurrenceType,
        until: typeof r.until === "string" ? r.until : undefined,
        exceptDates: Array.isArray(r.exceptDates)
          ? r.exceptDates.map(String).filter(Boolean)
          : undefined,
        customDates: Array.isArray(r.customDates)
          ? r.customDates.map(String).filter(Boolean)
          : undefined,
        monthlyRelative:
          r.monthlyRelative && typeof r.monthlyRelative === "object"
            ? (r.monthlyRelative as NonNullable<
                AreaEventPreset["recurrence"]
              >["monthlyRelative"])
            : undefined,
      };
    }
  }

  return {
    name,
    ...(description ? { description } : {}),
    ...(estimatedAttendees ? { estimatedAttendees } : {}),
    ...(recurrence ? { recurrence } : {}),
  };
}

export function parseAreaEventPresets(raw: string | undefined | null): AreaEventPreset[] {
  const trimmed = raw?.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) return [];
      const out: AreaEventPreset[] = [];
      const seen = new Set<string>();
      for (const item of parsed) {
        const preset = normalizeAreaEventPreset(item);
        if (!preset || seen.has(preset.name)) continue;
        seen.add(preset.name);
        out.push(preset);
      }
      return out;
    } catch {
      return [];
    }
  }
  return trimmed
    .split(/[\n,;|]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

export function serializeAreaEventPresets(presets: AreaEventPreset[]): string {
  const unique: AreaEventPreset[] = [];
  const seen = new Set<string>();
  for (const preset of presets) {
    const name = preset.name.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    unique.push({
      name,
      ...(preset.description?.trim()
        ? { description: preset.description.trim() }
        : {}),
      ...(preset.estimatedAttendees && preset.estimatedAttendees > 0
        ? { estimatedAttendees: preset.estimatedAttendees }
        : {}),
      ...(preset.recurrence?.type ? { recurrence: preset.recurrence } : {}),
    });
  }
  return JSON.stringify(unique);
}

export interface EventPresetFormHandlers {
  onEventNameChange: (value: string) => void;
  onEventDescriptionChange: (value: string) => void;
  onEstimatedAttendeesChange: (value: string) => void;
  onRecurrenceChange: (value: RecurrenceConfig) => void;
  onSendEventReminderChange?: (value: boolean) => void;
}

export function applyAreaEventPresetToForm(
  preset: AreaEventPreset,
  reservationDate: string,
  handlers: EventPresetFormHandlers,
): void {
  handlers.onEventNameChange(preset.name);
  handlers.onEventDescriptionChange(preset.description ?? "");
  handlers.onEstimatedAttendeesChange(
    preset.estimatedAttendees ? String(preset.estimatedAttendees) : "",
  );

  const r = preset.recurrence;
  if (r?.type && r.type !== "NONE") {
    handlers.onRecurrenceChange({
      type: r.type,
      until: r.until?.trim()
        ? r.until
        : defaultRecurrenceUntil(reservationDate, r.type),
      exceptDates: r.exceptDates ?? [],
      customDates: r.customDates ?? [],
      monthlyRelative: r.monthlyRelative,
    });
  } else {
    handlers.onRecurrenceChange({
      type: "NONE",
      until: "",
      exceptDates: [],
      customDates: [],
    });
  }
}

export function clearEventPresetFormFields(handlers: EventPresetFormHandlers): void {
  handlers.onEventNameChange("");
  handlers.onEventDescriptionChange("");
  handlers.onEstimatedAttendeesChange("");
  handlers.onRecurrenceChange({
    type: "NONE",
    until: "",
    exceptDates: [],
    customDates: [],
  });
}

export function eventNameMatchesAnyPreset(
  eventName: string,
  presets: AreaEventPreset[],
): boolean {
  const trimmed = eventName.trim();
  if (!trimmed) return false;
  return presets.some((p) => p.name === trimmed);
}

export function hasCapturedEventPresetData(
  eventName: string,
  eventDescription: string,
  estimatedAttendees: string,
  recurrence: RecurrenceConfig,
): boolean {
  return (
    eventName.trim().length >= 3 ||
    eventDescription.trim().length >= 3 ||
    Number(estimatedAttendees) > 0 ||
    recurrence.type !== "NONE"
  );
}

/** True if current form matches an event preset defined for the target area. */
export function currentEventDataFitsAreaPresets(
  presets: AreaEventPreset[],
  eventName: string,
  eventDescription: string,
  estimatedAttendees: string,
  recurrence: RecurrenceConfig,
): boolean {
  if (
    !hasCapturedEventPresetData(
      eventName,
      eventDescription,
      estimatedAttendees,
      recurrence,
    )
  ) {
    return true;
  }

  const name = eventName.trim();
  const preset = presets.find((p) => p.name.trim() === name);
  if (!preset) return false;

  if (preset.description?.trim()) {
    if (eventDescription.trim() !== preset.description.trim()) return false;
  } else if (eventDescription.trim().length >= 3) {
    return false;
  }

  if (preset.estimatedAttendees && preset.estimatedAttendees > 0) {
    if (Number(estimatedAttendees) !== preset.estimatedAttendees) return false;
  } else if (Number(estimatedAttendees) > 0) {
    return false;
  }

  if (preset.recurrence?.type && preset.recurrence.type !== "NONE") {
    if (recurrence.type !== preset.recurrence.type) return false;
  } else if (recurrence.type !== "NONE") {
    return false;
  }

  return true;
}
