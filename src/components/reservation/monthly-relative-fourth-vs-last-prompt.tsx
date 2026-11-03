"use client";

import { weekdayNameEs } from "@/lib/monthly-relative-recurrence";
import type { MonthlyRelativeOrdinal } from "@/lib/monthly-relative-recurrence";
import { Button } from "@/components/ui/button";

export function monthlyRelativeFourthVsLastLabels(dateIso: string): {
  fourthWeek: string;
  lastWeekday: string;
} {
  const weekday = weekdayNameEs(new Date(`${dateIso}T12:00:00`).getDay());
  return {
    fourthWeek: `${weekday} de la cuarta semana del mes`,
    lastWeekday: `Último ${weekday} del mes`,
  };
}

export function MonthlyRelativeFourthVsLastPrompt({
  dateIso,
  onChoose,
}: {
  dateIso: string;
  onChoose: (ordinal: Extract<MonthlyRelativeOrdinal, "FOURTH" | "LAST">) => void;
}) {
  const labels = monthlyRelativeFourthVsLastLabels(dateIso);
  const weekday = weekdayNameEs(new Date(`${dateIso}T12:00:00`).getDay());

  return (
    <section className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p>
        La fecha está en la cuarta o quinta semana del mes. Confirma cómo se
        repetirá cada mes:
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChoose("FOURTH")}
        >
          Como {labels.fourthWeek}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChoose("LAST")}
        >
          Como {labels.lastWeekday}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Día de la semana: {weekday}
      </p>
    </section>
  );
}
