import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/index";
import { isAdmin } from "@/lib/auth/permissions";
import {
  canAccessReservation,
  canCancelReservation,
  canModifyReservation,
} from "@/lib/auth/reservation-permissions";
import {
  cancelReservation,
  getReservationDetail,
  updateReservation,
} from "@/lib/reservation-service";
import { getReservationById } from "@/lib/sheets/reservations";

const updateSchema = z.object({
  eventName: z.string().min(1),
  eventDescription: z.string().optional().default(""),
  spaceIds: z.array(z.string()).min(1),
  areaId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  resources: z
    .array(
      z.object({
        resourceId: z.string(),
        quantity: z.coerce.number().min(0),
      }),
    )
    .optional()
    .default([]),
  confirmSimilarName: z.boolean().optional().default(false),
  estimatedAttendees: z.coerce.number().min(1),
  attendeeJustificationCode: z.string().optional().default(""),
  attendeeJustificationNote: z.string().optional().default(""),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const reservation = await getReservationById(id);
  if (!reservation || !canAccessReservation(session.user, reservation)) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const detail = await getReservationDetail(id);
  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getReservationById(id);
  if (!existing || !canModifyReservation(session.user, existing)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = isAdmin(session.user);
  let areaId = existing.areaId;
  if (parsed.data.areaId && admin) {
    areaId = parsed.data.areaId;
  }

  try {
    const result = await updateReservation(id, {
      eventName: parsed.data.eventName,
      eventDescription: parsed.data.eventDescription,
      spaceIds: parsed.data.spaceIds,
      areaId,
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      resources: parsed.data.resources.filter((item) => item.quantity > 0),
      confirmSimilarName: parsed.data.confirmSimilarName,
      requestedByAdmin: admin,
      estimatedAttendees: parsed.data.estimatedAttendees,
      attendeeJustificationCode: parsed.data.attendeeJustificationCode,
      attendeeJustificationNote: parsed.data.attendeeJustificationNote,
    });

    const detail = await getReservationDetail(id);
    return NextResponse.json({ ...detail, pending: result.pending });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al actualizar";

    if (message.startsWith("SIMILAR_NAME:")) {
      const [, similarName, score] = message.split(":");
      return NextResponse.json(
        {
          error: "similar_name",
          similarName,
          similarity: Number(score),
          message: `Ya existe un evento similar: "${similarName}". ¿Deseas continuar?`,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getReservationById(id);
  if (!existing || !canCancelReservation(session.user, existing)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const result = await cancelReservation(id, isAdmin(session.user));
  return NextResponse.json({ ok: true, pending: result.pending });
}
