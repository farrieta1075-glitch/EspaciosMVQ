import type { CSSProperties } from "react";
import type { Area } from "@/types/area";
import { buildAreaHierarchy } from "@/lib/area-scope";

export interface AreaColorStyle {
  hex: string;
  bg: string;
  border: string;
  dot: string;
  ring: string;
}

/** Gris claro para espacios disponibles (distinto de Servicios Pastorales #F5F5DC). */
export const MAP_AVAILABLE_HEX = "#D3D3D3";
export const MAP_AVAILABLE_STROKE = "#9E9E9E";
export const MAP_AVAILABLE_FILL = "rgba(211, 211, 211, 0.65)";

const AREA_HEX_BY_KEY: Record<string, string> = {
  creativo: "#FF0000",
  operativo: "#0000FF",
  "vida kids": "#FFFF00",
  comms: "#00FF00",
  "servicios pastorales": "#F5F5DC",
  pastoral: "#F5F5DC",
  formacion: "#4A235A",
  fomacion: "#4A235A",
  "equipo mv": "#FF1493",
  eventos: "#556B2F",
  "escuela de musica": "#FF7F00",
  "escuela de música": "#FF7F00",
  "grupos pequenos": "#8B4513",
  "grupo pequenos": "#8B4513",
  "grupo pequeños": "#8B4513",
};

const PALETTE_NEEDLES = Object.entries(AREA_HEX_BY_KEY).sort(
  (a, b) => b[0].length - a[0].length,
);

const FALLBACK_HEX = [
  "#FF0000",
  "#0000FF",
  "#FFFF00",
  "#00FF00",
  "#F5F5DC",
  "#4A235A",
  "#FF1493",
  "#556B2F",
  "#FF7F00",
  "#8B4513",
];

function normalizeAreaKey(name: string, code: string): string {
  const raw = `${name} ${code}`
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
  return raw;
}

function hashAreaId(areaId: string): number {
  let hash = 0;
  for (const char of areaId) {
    hash = (hash + char.charCodeAt(0)) % FALLBACK_HEX.length;
  }
  return hash;
}

/** Acepta #RGB, #RRGGBB o RRGGBB. */
export function parseColorHex(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;
  if (!value.startsWith("#")) value = `#${value}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value.toUpperCase();
  return null;
}

function tokensInclude(key: string, needle: string): boolean {
  const haystack = key.split(/\s+/).filter(Boolean);
  const needleTokens = needle.split(/\s+/).filter(Boolean);
  if (needleTokens.length === 0) return false;
  for (let index = 0; index <= haystack.length - needleTokens.length; index += 1) {
    if (needleTokens.every((token, offset) => haystack[index + offset] === token)) {
      return true;
    }
  }
  return false;
}

function lookupPaletteHex(
  area: Pick<Area, "name" | "code">,
): string | null {
  const key = normalizeAreaKey(area.name, area.code ?? "");
  for (const [needle, hex] of PALETTE_NEEDLES) {
    if (tokensInclude(key, needle)) return hex;
  }
  return null;
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(211, 211, 211, ${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveAreaHex(
  area: Pick<Area, "id" | "name" | "code" | "colorHex">,
): string {
  return (
    parseColorHex(area.colorHex) ??
    lookupPaletteHex(area) ??
    FALLBACK_HEX[hashAreaId(area.id)] ??
    FALLBACK_HEX[0]
  );
}

function mixHexWithWhite(hex: string, whiteMix: number): string {
  const amount = Math.min(1, Math.max(0, whiteMix));
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * amount);
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

function resolveAreaHexWithHierarchy(area: Area, allAreas: Area[]): string {
  const ownExplicit = parseColorHex(area.colorHex);
  if (ownExplicit) return ownExplicit;
  const ownPalette = lookupPaletteHex(area);
  if (ownPalette) return ownPalette;

  const { areasById, childrenByParent } = buildAreaHierarchy(allAreas);
  const chain: Area[] = [area];
  let current: Area | undefined = area;
  while (current?.parentId && areasById.has(current.parentId)) {
    const parent: Area = areasById.get(current.parentId)!;
    chain.unshift(parent);
    current = parent;
  }

  const root = chain[0] ?? area;
  let baseHex: string | null = null;
  for (const node of chain) {
    const hex = parseColorHex(node.colorHex) ?? lookupPaletteHex(node);
    if (hex) {
      baseHex = hex;
      break;
    }
  }
  if (!baseHex) {
    baseHex = FALLBACK_HEX[hashAreaId(root.id)] ?? FALLBACK_HEX[0];
  }

  if (!area.parentId || chain.length <= 1) {
    return baseHex;
  }

  const depth = chain.length - 1;
  const parent = areasById.get(area.parentId);
  const siblings = parent
    ? (childrenByParent.get(parent.id) ?? [area])
    : [area];
  const siblingIndex = Math.max(
    0,
    siblings.findIndex((item) => item.id === area.id),
  );
  const siblingCount = Math.max(siblings.length, 1);
  const siblingSpread =
    siblingCount > 1 ? (siblingIndex + 1) / siblingCount : 0.5;
  const depthStep = 0.14;
  const siblingStep = 0.1;
  const lighten = Math.min(
    0.72,
    depth * depthStep + siblingSpread * siblingStep * depth,
  );

  return mixHexWithWhite(baseHex, lighten);
}

function styleFromHex(hex: string): AreaColorStyle {
  return {
    hex,
    bg: "",
    border: "",
    dot: "",
    ring: "",
  };
}

export function getAreaColor(
  area: Pick<Area, "id" | "name" | "code" | "colorHex" | "parentId"> | null | undefined,
  allAreas?: Area[],
): AreaColorStyle {
  if (!area) {
    return {
      hex: "#A8A29E",
      bg: "bg-muted/60",
      border: "border-muted-foreground/40",
      dot: "bg-muted-foreground/50",
      ring: "ring-muted-foreground/30",
    };
  }
  const fullArea = allAreas?.find((item) => item.id === area.id);
  const hex =
    fullArea && allAreas
      ? resolveAreaHexWithHierarchy(fullArea, allAreas)
      : resolveAreaHex(area);
  return styleFromHex(hex);
}

export function getAreaHex(
  area: Pick<Area, "id" | "name" | "code" | "colorHex" | "parentId"> | null | undefined,
  allAreas?: Area[],
): string {
  return getAreaColor(area, allAreas).hex;
}

export function buildAreaColorMap(areas: Area[]): Map<string, AreaColorStyle> {
  return new Map(areas.map((area) => [area.id, getAreaColor(area, areas)]));
}

export function areaCardStyle(color: AreaColorStyle): CSSProperties {
  return {
    backgroundColor: hexToRgba(color.hex, 0.18),
    borderColor: color.hex,
  };
}
