import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/index";
import { isAdmin } from "@/lib/auth/permissions";
import { decisionActorFromSession } from "@/lib/reservation-decision";
import {
  canAccessReservation,
  canCancelReservation,
  canModifyReservation,
} from "@/lib/auth/reservation-permissions";
import { resolveUserAreaScopeIds } from "@/lib/area-scope";
import {
  cancelReservation,
  getReservationDetail,
  updateReservation,
} from "@/lib/reservation-service";
import { getAllAreas } from "@/lib/sheets/areas";
import { getReservationById } from "@/lib/sheets/reservations";
import { getUserById } from "@/lib/sheets/users";

async function loadAreaAccess(userId: string) {
  const [userRecord, areas] = await Promise.all([
    getUserById(userId),
    getAllAreas(),
  ]);
  return {
    areaScopeIds: userRecord
      ? resolveUserAreaScopeIds(userRecord, areas)
      : [],
  };
}

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
  const [reservation, areaAccess] = await Promise.all([
    getReservationById(id),
    loadAreaAccess(session.user.id),
  ]);
  if (!reservation || !canAccessReservation(session.user, reservation, areaAccess)) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const detail = await getReservationDetail(id);
  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const [existing, areaAccess] = await Promise.all([
    getReservationById(id),
    loadAreaAccess(session.user.id),
  ]);
  if (!existing || !canModifyReservation(session.user, existing, areaAccess)) {
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
      actor: decisionActorFromSession(session.user),
    });

    const detail = await getReservationDetail(id);
    if (!admin) {
      const { recordGeneralUserActivity } = await import("@/lib/activity-log");
      await recordGeneralUserActivity({
        user: session.user,
        action: "UPDATE_RESERVATION",
        summary: `Modificó reserva «${parsed.data.eventName.trim()}»`,
        path: `/reservas/${id}/editar`,
        meta: { reservationId: id, pending: result.pending },
      });
    }
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
  } catch (error) {
    console.error("[reservas PATCH]", error);
    return NextResponse.json(
      {
        error:
          "No se pudo completar la actualización. Intenta de nuevo en unos segundos.",
      },
      { status: 500 },
    );
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
  const [existing, areaAccess] = await Promise.all([
    getReservationById(id),
    loadAreaAccess(session.user.id),
  ]);
  if (!existing || !canCancelReservation(session.user, existing, areaAccess)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const admin = isAdmin(session.user);
  const result = await cancelReservation(
    id,
    admin,
    decisionActorFromSession(session.user),
  );
  if (!admin) {
    const { recordGeneralUserActivity } = await import("@/lib/activity-log");
    await recordGeneralUserActivity({
      user: session.user,
      action: "CANCEL_RESERVATION",
      summary: `Canceló o solicitó cancelación «${existing.eventName}»`,
      path: "/reservas",
      meta: { reservationId: id, pending: result.pending },
    });
  }
  return NextResponse.json({ ok: true, pending: result.pending });
}
