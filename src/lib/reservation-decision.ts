import type {
  DecisionActor,
  Reservation,
  ReservationActivityEntry,
  ReservationActivityKind,
  ReservationDecision,
} from "@/types/reservation";
import { reservationNeedsAdminAction } from "@/types/reservation";

export type AuthorizationVisual = "pending" | "approved" | "rejected";

export function emptyReservationDecision(): {
  decision: ReservationDecision;
  decisionByName: string;
  decisionByUserId: string;
  decisionAt: string;
  activityLog: string;
} {
  return {
    decision: "",
    decisionByName: "",
    decisionByUserId: "",
    decisionAt: "",
    activityLog: "[]",
  };
}

export function parseReservationActivityLog(
  raw: string | null | undefined,
): ReservationActivityEntry[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Partial<ReservationActivityEntry>;
        const kind = row.kind;
        if (
          kind !== "REQUESTED" &&
          kind !== "MODIFIED" &&
          kind !== "CANCELLED"
        ) {
          return null;
        }
        const name = String(row.name ?? "").trim();
        const at = String(row.at ?? "").trim();
        if (!name || !at) return null;
        return {
          kind,
          name,
          userId: String(row.userId ?? ""),
          at,
        };
      })
      .filter((item): item is ReservationActivityEntry => item !== null);
  } catch {
    return [];
  }
}

export function appendReservationActivity(
  reservation: Reservation,
  kind: ReservationActivityKind,
  actor?: DecisionActor,
): Reservation {
  const name = actor?.name?.trim() || "Usuario";
  const entries = parseReservationActivityLog(reservation.activityLog);
  entries.push({
    kind,
    name,
    userId: actor?.userId?.trim() ?? "",
    at: new Date().toISOString(),
  });
  return {
    ...reservation,
    activityLog: JSON.stringify(entries),
  };
}

export function activityKindLabel(kind: ReservationActivityKind): string {
  if (kind === "REQUESTED") return "Solicitó";
  if (kind === "MODIFIED") return "Modificó";
  return "Canceló";
}

export function stampReservationDecision(
  reservation: Reservation,
  actor: DecisionActor | undefined,
  decision: Exclude<ReservationDecision, "">,
): Reservation {
  const name = actor?.name?.trim() || "Administrador";
  return {
    ...reservation,
    decision,
    decisionByName: name,
    decisionByUserId: actor?.userId?.trim() ?? "",
    decisionAt: new Date().toISOString(),
  };
}

export function authorizationVisual(
  reservation: Reservation,
): AuthorizationVisual {
  if (reservationNeedsAdminAction(reservation)) return "pending";
  if (reservation.decision === "REJECTED") return "rejected";
  if (reservation.decision === "APPROVED") return "approved";
  if (reservation.status === "CONFIRMED") return "approved";
  if (reservation.status === "CANCELLED") return "rejected";
  return "pending";
}

export function formatAuthorizationWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = date
    .toLocaleDateString("es-MX", { month: "short" })
    .replace(/\./g, "")
    .replace(/\s/g, "")
    .toLowerCase();
  const time = date
    .toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replaceAll(".", "")
    .replace(/\s/g, "")
    .toLowerCase();
  return `${day}${month} ${time}`;
}

export function authorizationDetailText(reservation: Reservation): string {
  const visual = authorizationVisual(reservation);
  if (visual === "pending") return "Autorización: Pendiente.";
  const label = visual === "approved" ? "Confirmado" : "Rechazado";
  const name = reservation.decisionByName.trim();
  const when = reservation.decisionAt
    ? formatAuthorizationWhen(reservation.decisionAt)
    : "";
  const parts = [`Autorización: ${label}`];
  if (name) parts.push(name);
  if (when) parts.push(when);
  return parts.join(" / ");
}

export function decisionActorFromSession(user: {
  id?: string | null;
  name?: string | null;
  email?: string | null;
} | null): DecisionActor {
  if (!user) return { name: "Correo" };
  return {
    userId: user.id ?? "",
    name: user.name?.trim() || user.email?.trim() || "Administrador",
  };
}
