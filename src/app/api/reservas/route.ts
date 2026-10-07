import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/index";
import { isAdmin } from "@/lib/auth/permissions";
import {
  createReservation,
  listReservationDetails,
} from "@/lib/reservation-service";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = isAdmin(session.user);
  const reservations = await listReservationDetails(
    session.user.areaId ?? null,
    admin,
  );

  return NextResponse.json(
    reservations.sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    ),
  );
}

const recurrenceSchema = z.object({
  type: z.enum(["NONE", "DAILY", "WEEKLY"]),
  until: z.string().optional().default(""),
});

const createSchema = z.object({
  eventName: z.string().min(1),
  eventDescription: z.string().optional().default(""),
  spaceIds: z.array(z.string()).min(1),
  areaId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  recurrence: recurrenceSchema,
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

export async function POST(request: Request) {
  try {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstField = Object.keys(fieldErrors)[0];
    const firstMessage = firstField
      ? fieldErrors[firstField as keyof typeof fieldErrors]?.[0]
      : undefined;
    return NextResponse.json(
      {
        error: firstMessage ?? "Datos inválidos",
        details: fieldErrors,
      },
      { status: 400 },
    );
  }

  const user = session.user;
  const admin = isAdmin(user);
  const sessionAreaId = user.areaId?.trim() ?? "";

  let areaId: string;

  if (admin) {
    areaId = parsed.data.areaId?.trim() || sessionAreaId;
    if (!areaId) {
      return NextResponse.json(
        { error: "Selecciona el área de la reserva." },
        { status: 400 },
      );
    }
  } else {
    if (!sessionAreaId) {
      return NextResponse.json(
        { error: "Tu usuario no tiene un área asignada." },
        { status: 400 },
      );
    }
    const requestedAreaId = parsed.data.areaId?.trim();
    if (requestedAreaId && requestedAreaId !== sessionAreaId) {
      return NextResponse.json(
        { error: "No puedes reservar para otra área." },
        { status: 403 },
      );
    }
    areaId = sessionAreaId;
  }

  const recurrence = {
    type: parsed.data.recurrence.type,
    until:
      parsed.data.recurrence.type === "NONE"
        ? parsed.data.date
        : parsed.data.recurrence.until || parsed.data.date,
  };

  if (
    recurrence.type !== "NONE" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(recurrence.until)
  ) {
    return NextResponse.json(
      { error: "Indica una fecha final válida para la recurrencia." },
      { status: 400 },
    );
  }

  try {
    const result = await createReservation({
      eventName: parsed.data.eventName,
      eventDescription: parsed.data.eventDescription,
      spaceIds: parsed.data.spaceIds,
      areaId: areaId || "general",
      userId: user.id,
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      recurrence,
      resources: parsed.data.resources.filter((item) => item.quantity > 0),
      confirmSimilarName: parsed.data.confirmSimilarName,
      createdByAdmin: admin,
      estimatedAttendees: parsed.data.estimatedAttendees,
      attendeeJustificationCode: parsed.data.attendeeJustificationCode,
      attendeeJustificationNote: parsed.data.attendeeJustificationNote,
    });

    revalidatePath("/calendario");
    revalidatePath("/reservas");
    revalidatePath("/admin/aprobaciones");

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al reservar";

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
    console.error("[reservas POST]", error);
    return NextResponse.json(
      {
        error:
          "No se pudo completar la reserva. Intenta de nuevo en unos segundos.",
      },
      { status: 500 },
    );
  }
}
