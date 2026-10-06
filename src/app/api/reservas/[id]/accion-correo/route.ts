import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { renderApprovalActionResultPage } from "@/lib/email/approval-action-html";
import { approvalResponderUrl } from "@/lib/email/approval-email-content";
import { decideReservationByToken } from "@/lib/reservation-service";
import { getReservationById } from "@/lib/sheets/reservations";
import { reservationNeedsAdminAction } from "@/types/reservation";

function htmlResponse(html: string, status = 200) {
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  const action = url.searchParams.get("action")?.trim().toLowerCase();

  if (!token || (action !== "approve" && action !== "reject")) {
    return htmlResponse(
      renderApprovalActionResultPage({
        ok: false,
        approved: false,
        title: "Enlace no válido",
        message: "Faltan datos en el enlace del correo. Usa los botones del mensaje más reciente.",
      }),
      400,
    );
  }

  const reservation = await getReservationById(id);
  if (!reservation) {
    return htmlResponse(
      renderApprovalActionResultPage({
        ok: false,
        approved: false,
        title: "Reserva no encontrada",
        message: "La solicitud ya no existe o el identificador es incorrecto.",
      }),
      404,
    );
  }

  if (!reservation.approvalToken || reservation.approvalToken !== token) {
    return htmlResponse(
      renderApprovalActionResultPage({
        ok: false,
        approved: false,
        title: "Enlace expirado",
        message:
          "Este enlace ya no es válido (puede que la solicitud ya se haya procesado).",
        eventName: reservation.eventName,
        detailUrl: approvalResponderUrl(reservation),
      }),
      403,
    );
  }

  if (!reservationNeedsAdminAction(reservation)) {
    return htmlResponse(
      renderApprovalActionResultPage({
        ok: true,
        approved: reservation.status === "CONFIRMED",
        title: "Solicitud ya procesada",
        message: "Esta reserva ya fue atendida anteriormente.",
        eventName: reservation.eventName,
      }),
    );
  }

  const approve = action === "approve";

  try {
    const detail = await decideReservationByToken({
      id,
      token,
      approve,
    });

    if (!detail) {
      return htmlResponse(
        renderApprovalActionResultPage({
          ok: false,
          approved: false,
          title: "No se pudo completar",
          message: "No fue posible registrar tu respuesta. Intenta desde la aplicación.",
          eventName: reservation.eventName,
        }),
        400,
      );
    }

    revalidatePath("/calendario");
    revalidatePath("/reservas");
    revalidatePath("/admin/aprobaciones");

    return htmlResponse(
      renderApprovalActionResultPage({
        ok: true,
        approved: approve,
        title: approve ? "Autorizada" : "Rechazada",
        message: approve
          ? "La solicitud fue autorizada correctamente."
          : "La solicitud fue rechazada.",
        eventName: detail.eventName,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al procesar la solicitud.";
    return htmlResponse(
      renderApprovalActionResultPage({
        ok: false,
        approved: false,
        title: "Error",
        message,
        eventName: reservation.eventName,
      }),
      500,
    );
  }
}
