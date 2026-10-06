import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/index";
import { isAdmin } from "@/lib/auth/permissions";
import {
  buildApprovalChangeSummary,
  type ApprovalChangeSummary,
} from "@/lib/approval-change-summary";
import {
  approveReservation,
  decideReservationByToken,
  getReservationDetail,
  rejectReservation,
} from "@/lib/reservation-service";
import { getAllSpaces } from "@/lib/sheets/spaces";
import { getReservationById } from "@/lib/sheets/reservations";
import { parsePendingPayload } from "@/types/reservation";
import { reservationNeedsAdminAction } from "@/types/reservation";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  token: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await bodySchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const session = await auth();
  const reservation = await getReservationById(id);
  if (!reservation) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const approve = body.data.action === "approve";

  if (body.data.token) {
    const detail = await decideReservationByToken({
      id,
      token: body.data.token,
      approve,
    });
    if (!detail) {
      return NextResponse.json({ error: "Enlace inválido o expirado" }, { status: 403 });
    }
    return NextResponse.json(detail);
  }

  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const detail = approve
    ? await approveReservation(id)
    : await rejectReservation(id);

  if (!detail) {
    return NextResponse.json({ error: "No se pudo procesar la solicitud" }, { status: 400 });
  }

  return NextResponse.json(detail);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token")?.trim();

  const reservation = await getReservationById(id);
  if (!reservation) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  if (token) {
    if (!reservation.approvalToken || reservation.approvalToken !== token) {
      return NextResponse.json({ error: "Enlace inválido o expirado" }, { status: 403 });
    }
  } else {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const detail = await getReservationDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const payload = parsePendingPayload(reservation.pendingPayload);
  const spaces = await getAllSpaces();
  const pendingSpaceNames = payload
    ? payload.spaceIds.map(
        (spaceId) =>
          spaces.find((space) => space.id === spaceId)?.name ?? spaceId,
      )
    : undefined;

  const changeSummary: ApprovalChangeSummary = buildApprovalChangeSummary({
    reservation,
    spaceNames: detail.spaceNames,
    pendingSpaceNames,
    resources: detail.resources,
    areaName: detail.areaName,
  });

  return NextResponse.json({
    ...detail,
    changeSummary,
    canRespond: reservationNeedsAdminAction(reservation),
    tokenAccepted: Boolean(token),
  });
}
