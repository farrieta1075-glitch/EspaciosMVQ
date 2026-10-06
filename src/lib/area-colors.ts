import type { Area } from "@/types/area";

export interface AreaColorStyle {
  bg: string;
  border: string;
  dot: string;
  ring: string;
}

const VIDA_KIDS_COLOR: AreaColorStyle = {
  bg: "bg-fuchsia-500/25",
  border: "border-fuchsia-500",
  dot: "bg-fuchsia-500",
  ring: "ring-fuchsia-500/40",
};

const DEFAULT_PALETTE: AreaColorStyle[] = [
  {
    bg: "bg-sky-500/20",
    border: "border-sky-500",
    dot: "bg-sky-500",
    ring: "ring-sky-500/40",
  },
  {
    bg: "bg-emerald-500/20",
    border: "border-emerald-500",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/40",
  },
  {
    bg: "bg-amber-500/20",
    border: "border-amber-500",
    dot: "bg-amber-500",
    ring: "ring-amber-500/40",
  },
  {
    bg: "bg-violet-500/20",
    border: "border-violet-500",
    dot: "bg-violet-500",
    ring: "ring-violet-500/40",
  },
  {
    bg: "bg-rose-500/20",
    border: "border-rose-500",
    dot: "bg-rose-500",
    ring: "ring-rose-500/40",
  },
  {
    bg: "bg-cyan-500/20",
    border: "border-cyan-500",
    dot: "bg-cyan-500",
    ring: "ring-cyan-500/40",
  },
];

function hashAreaId(areaId: string): number {
  let hash = 0;
  for (const char of areaId) {
    hash = (hash + char.charCodeAt(0)) % DEFAULT_PALETTE.length;
  }
  return hash;
}

export function getAreaColor(
  area: Pick<Area, "id" | "name" | "code"> | null | undefined,
): AreaColorStyle {
  if (!area) {
    return {
      bg: "bg-muted/60",
      border: "border-muted-foreground/40",
      dot: "bg-muted-foreground/50",
      ring: "ring-muted-foreground/30",
    };
  }

  const name = area.name.toLowerCase();
  const code = area.code.toLowerCase();
  if (name.includes("vida kids") || code === "vk" || code.includes("vk")) {
    return VIDA_KIDS_COLOR;
  }

  return DEFAULT_PALETTE[hashAreaId(area.id)] ?? DEFAULT_PALETTE[0];
}

export function buildAreaColorMap(areas: Area[]): Map<string, AreaColorStyle> {
  return new Map(areas.map((area) => [area.id, getAreaColor(area)]));
}
