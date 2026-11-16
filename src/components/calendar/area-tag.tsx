import { areaCardStyle, type AreaColorStyle } from "@/lib/area-colors";
import { cn } from "@/lib/utils";

interface AreaTagProps {
  name: string;
  color: AreaColorStyle;
  className?: string;
}

export function AreaTag({ name, color, className }: AreaTagProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs text-foreground",
        className,
      )}
      style={areaCardStyle(color)}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color.hex }}
        aria-hidden
      />
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}
