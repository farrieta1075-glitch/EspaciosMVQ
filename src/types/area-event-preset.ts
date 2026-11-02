import type {
  MonthlyRelativeOrdinal,
  RecurrenceType,
} from "@/types/reservation";

export interface AreaEventPresetRecurrence {
  type: RecurrenceType;
  until?: string;
  exceptDates?: string[];
  customDates?: string[];
  monthlyRelative?: {
    weekday: number;
    ordinal: MonthlyRelativeOrdinal;
  };
}

export interface AreaEventPreset {
  name: string;
  description?: string;
  estimatedAttendees?: number;
  recurrence?: AreaEventPresetRecurrence;
}
