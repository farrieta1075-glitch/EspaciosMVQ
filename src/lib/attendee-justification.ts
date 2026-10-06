export const ATTENDEE_JUSTIFICATION_OPTIONS = [
  { code: "NO_OTHER_AREA", label: "No había otra área disponible" },
  { code: "NEEDS_LARGE_SPACE", label: "Se requiere espacio amplio" },
  { code: "NEEDS_SMALL_SPACE", label: "Se requiere espacio reducido" },
  { code: "NEEDS_TECH", label: "Se requiere instalaciones técnicas" },
  { code: "NEEDS_LIGHTING", label: "Se requiere una mejor iluminación" },
  { code: "OTHER", label: "Otro" },
] as const;

export type AttendeeJustificationCode =
  (typeof ATTENDEE_JUSTIFICATION_OPTIONS)[number]["code"];

export function attendeeJustificationLabel(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  return (
    ATTENDEE_JUSTIFICATION_OPTIONS.find((item) => item.code === code)?.label ??
    code
  );
}
