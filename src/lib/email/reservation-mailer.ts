import "server-only";
import { getAreaById } from "@/lib/sheets/areas";
import type { Reservation } from "@/types/reservation";
import { reservationNeedsAdminAction } from "@/types/reservation";
import { buildWhatsAppNotifyLinks } from "@/lib/whatsapp/notify-links";
import { isEmailTransportConfigured } from "@/lib/email/mail-transport";
import { sendMail } from "@/lib/email/send-mail";
import {
  getAdminNotificationEmails,
  listActiveAdminUsers,
} from "@/lib/email/admin-recipients";
import { buildAdminApprovalEmailContent } from "@/lib/email/approval-email-content";
import { createNotification } from "@/lib/sheets/notifications";

async function notifyAdminsInAppAndPush(
  reservation: Reservation,
  options?: { occurrenceCount?: number },
): Promise<void> {
  const [admins, area] = await Promise.all([
    listActiveAdminUsers(),
    getAreaById(reservation.areaId),
  ]);
  const areaName = area?.name ?? reservation.areaId;
  const occLabel =
    options?.occurrenceCount && options.occurrenceCount > 1
      ? ` (${options.occurrenceCount} fechas)`
      : "";
  const message = `Solicitud pendiente: «${reservation.eventName}» en ${areaName}${occLabel}.`;

  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      areaId: reservation.areaId,
      reservationId: reservation.id,
      type: "APPROVAL_NEEDED",
      message,
    });
  }
}

export async function notifyAdminsReservationApprovalNeeded(
  reservation: Reservation,
  options?: { occurrenceCount?: number },
): Promise<void> {
  if (!reservationNeedsAdminAction(reservation)) return;

  try {
    await notifyAdminsInAppAndPush(reservation, options);
  } catch (error) {
    console.error(
      "[notifications] No se pudo avisar in-app/push a administradores:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    await sendAdminApprovalEmails(reservation, options);
  } catch (error) {
    console.error(
      "[email] No se pudo enviar aviso a administradores:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function sendAdminApprovalEmails(
  reservation: Reservation,
  options?: { occurrenceCount?: number },
): Promise<void> {
  const [{ emails: adminEmails, skipped }, area] = await Promise.all([
    getAdminNotificationEmails(),
    getAreaById(reservation.areaId),
  ]);

  if (skipped.length > 0) {
    console.warn("[email] Administradores omitidos para notificación:", skipped);
  }

  if (adminEmails.length === 0) {
    console.warn(
      "No hay administradores con correo válido para notificar. Revisa la hoja Usuarios (rol ADMIN, active=true, columna email).",
    );
    return;
  }

  const areaName = area?.name ?? reservation.areaId;
  const emailContent = await buildAdminApprovalEmailContent({
    reservation,
    areaName,
    occurrenceCount: options?.occurrenceCount,
  });

  const whatsappText = [
    `MVQro Espacios — ${areaName}`,
    emailContent.subject,
    `Evento: ${reservation.eventName}`,
    `Responder: ${emailContent.responderUrl}`,
  ].join("\n");

  const whatsappLinks = buildWhatsAppNotifyLinks(whatsappText);
  const whatsappBlock =
    whatsappLinks.length > 0
      ? `\n\nWhatsApp:\n${whatsappLinks.join("\n")}`
      : "";

  const text = `${emailContent.text}${whatsappBlock}`;
  const whatsappHtml =
    whatsappLinks.length > 0
      ? `<p style="margin-top:16px;"><a href="${whatsappLinks[0]}" style="color:#25D366;">Abrir WhatsApp</a></p>`
      : "";

  console.info(
    `[email] Enviando aviso a ${adminEmails.length} administrador(es): ${adminEmails.join(", ")}`,
  );

  try {
    const result = await sendMail({
      to: adminEmails,
      subject: emailContent.subject,
      text,
      html: `${emailContent.html}${whatsappHtml}`,
    });

    if (result.sent) {
      console.info(
        `[email] Aviso enviado a ${adminEmails.length} destinatario(s) en un solo mensaje.`,
      );
    } else {
      console.info("[email] Aviso no enviado por correo:", emailContent.responderUrl);
    }
  } catch (error) {
    console.error(
      "[email] Fallo envío grupal; reintentando uno por uno…",
      error instanceof Error ? error.message : error,
    );

    let sentCount = 0;
    for (const email of adminEmails) {
      try {
        const single = await sendMail({
          to: email,
          subject: emailContent.subject,
          text,
          html: `${emailContent.html}${whatsappHtml}`,
        });
        if (single.sent) sentCount += 1;
      } catch (singleError) {
        console.error(
          `[email] Fallo enviando a ${email}:`,
          singleError instanceof Error ? singleError.message : singleError,
        );
      }
    }
    console.info(`[email] Reintento individual: ${sentCount}/${adminEmails.length} enviados.`);
  }

  if (!isEmailTransportConfigured()) {
    console.info("[email] Configura EMAIL_SMTP_* o EMAIL_SERVER para envío real.");
  }
}

export async function notifyUserReservationDecision(input: {
  email: string | null;
  subject: string;
  message: string;
}): Promise<void> {
  if (!input.email) return;
  await sendMail({
    to: input.email,
    subject: input.subject,
    text: input.message,
    html: `<p>${input.message}</p>`,
  });
}
