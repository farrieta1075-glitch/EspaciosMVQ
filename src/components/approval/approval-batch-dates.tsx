import { formatDateTimeRange } from "@/lib/approval-change-summary";
import type { ApprovalBatchOccurrence } from "@/types/reservation";

export function ApprovalBatchDatesList({
  occurrences,
  compact = false,
}: {
  occurrences: ApprovalBatchOccurrence[];
  compact?: boolean;
}) {
  if (occurrences.length <= 1) return null;

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <p className={compact ? "text-xs font-medium" : "text-sm font-medium"}>
        Fechas incluidas ({occurrences.length})
      </p>
      <ul
        className={
          compact
            ? "max-h-40 list-inside list-disc overflow-y-auto text-xs text-muted-foreground"
            : "max-h-52 list-inside list-disc overflow-y-auto text-sm text-muted-foreground"
        }
      >
        {occurrences.map((occurrence, index) => (
          <li key={`${occurrence.startAt}-${index}`}>
            {formatDateTimeRange(occurrence.startAt, occurrence.endAt)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Autorizar o rechazar aplica a todas las fechas de la serie.
      </p>
    </div>
  );
}
