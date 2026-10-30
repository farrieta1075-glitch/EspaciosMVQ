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
import { getApprovalResolution } from "@/lib/approval-resolution";
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

  const resolution = getApprovalResolution(reservation);

  if (body.data.token) {
    if (
      !reservation.approvalToken ||
      reservation.approvalToken !== body.data.token
    ) {
      if (resolution.handled && resolution.message) {
        return NextResponse.json({ error: resolution.message }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Enlace inválido o expirado" },
        { status: 403 },
      );
    }

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

  if (resolution.handled && resolution.message) {
    return NextResponse.json({ error: resolution.message }, { status: 409 });
  }

  try {
    const detail = approve
      ? await approveReservation(id)
      : await rejectReservation(id);

    if (!detail) {
      return NextResponse.json(
        { error: "No se pudo procesar la solicitud" },
        { status: 400 },
      );
    }

    return NextResponse.json(detail);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo procesar la solicitud.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
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

  const resolution = getApprovalResolution(reservation);

  if (token) {
    if (!reservation.approvalToken || reservation.approvalToken !== token) {
      if (resolution.handled && resolution.message) {
        const detail = await getReservationDetail(id);
        if (!detail) {
          return NextResponse.json(
            { error: "Reserva no encontrada" },
            { status: 404 },
          );
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
          canRespond: false,
          resolutionMessage: resolution.message,
          resolutionOutcome: resolution.outcome,
        });
      }
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
    resolutionMessage: resolution.handled ? resolution.message : null,
    resolutionOutcome: resolution.handled ? resolution.outcome : null,
  });
}
