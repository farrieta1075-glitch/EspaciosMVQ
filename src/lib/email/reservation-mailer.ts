import "server-only";
import {
  adminAlertPushTitle,
  buildAdminAlertMessage,
  resolveAdminAlertBatchId,
  resolveAdminAlertKind,
  stripAdminAlertBatchMarker,
  type AdminAlertKind,
} from "@/lib/admin-alert-notifications";
import { getAreaById } from "@/lib/sheets/areas";
import type { Reservation } from "@/types/reservation";
import { reservationNeedsAdminAction } from "@/types/reservation";
import { buildWhatsAppNotifyLinks } from "@/lib/whatsapp/notify-links";
import { isEmailTransportConfigured } from "@/lib/email/mail-transport";
import { sendMail } from "@/lib/email/send-mail";
import {
  getAdminNotificationEmails,
  listAdminsForApprovalAlerts,
} from "@/lib/email/admin-recipients";
import { buildAdminApprovalEmailContent } from "@/lib/email/approval-email-content";
import {
  createNotification,
  hasAdminAlertForBatch,
} from "@/lib/sheets/notifications";
import { getPendingCreateBatchMembers } from "@/lib/approval-batch";

async function notifyAdminsInAppAndPush(
  reservation: Reservation,
  options?: { occurrenceCount?: number; alertKind?: AdminAlertKind },
): Promise<void> {
  const batch = await getPendingCreateBatchMembers(reservation);
  const alertKind = resolveAdminAlertKind(reservation, options?.alertKind);
  const batchId = resolveAdminAlertBatchId(reservation, alertKind, batch);

  const [admins, area] = await Promise.all([
    listAdminsForApprovalAlerts(),
    getAreaById(reservation.areaId),
  ]);
  if (admins.length === 0) {
    console.warn(
      "[notifications] No hay administradores con avisos habilitados (ADMIN + recibir correos de autorización).",
    );
    return;
  }

  const areaName = area?.name ?? reservation.areaId;
  const count = options?.occurrenceCount ?? batch.length;
  const message = buildAdminAlertMessage({
    kind: alertKind,
    batchId,
    eventName: reservation.eventName,
    areaName,
    occurrenceCount: count > 1 ? count : undefined,
  });
  const pushTag = `approval-${alertKind}-${batchId}`.slice(0, 64);
  const pushTitle = adminAlertPushTitle(alertKind);

  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      areaId: reservation.areaId,
      reservationId: batch[0]?.id ?? reservation.id,
      type: "APPROVAL_NEEDED",
      message,
      pushTag,
      pushTitle,
    });
  }
}

export async function notifyAdminsReservationApprovalNeeded(
  reservation: Reservation,
  options?: { occurrenceCount?: number; alertKind?: AdminAlertKind },
): Promise<void> {
  const alertKind = resolveAdminAlertKind(reservation, options?.alertKind);
  if (alertKind !== "withdraw" && !reservationNeedsAdminAction(reservation)) {
    return;
  }

  const batch = await getPendingCreateBatchMembers(reservation);
  const batchId = resolveAdminAlertBatchId(reservation, alertKind, batch);
  const alreadyNotified = await hasAdminAlertForBatch({
    approvalBatchId: batchId,
    alertKind,
  });

  try {
    if (!alreadyNotified) {
      await notifyAdminsInAppAndPush(reservation, options);
    }
  } catch (error) {
    console.error(
      "[notifications] No se pudo avisar in-app/push a administradores:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    if (!alreadyNotified && alertKind !== "withdraw") {
      await sendAdminApprovalEmails(reservation, options);
    } else if (!alreadyNotified && alertKind === "withdraw") {
      await sendAdminWithdrawalEmails(reservation, options);
    }
  } catch (error) {
    console.error(
      "[email] No se pudo enviar aviso a administradores:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function sendAdminWithdrawalEmails(
  reservation: Reservation,
  options?: { occurrenceCount?: number },
): Promise<void> {
  const [{ emails: adminEmails, skipped }, area] = await Promise.all([
    getAdminNotificationEmails(),
    getAreaById(reservation.areaId),
  ]);

  if (skipped.length > 0) {
    console.warn("[email] Administradores omitidos:", skipped);
  }
  if (adminEmails.length === 0) {
    console.warn("[email] No hay correos de admin para aviso de retiro.");
    return;
  }

  const areaName = area?.name ?? reservation.areaId;
  const count = options?.occurrenceCount;
  const countNote = count && count > 1 ? ` (${count} fechas)` : "";
  const subject = `MVQro Espacios — ${areaName}: solicitud retirada${countNote}`;
  const text = [
    `El solicitante retiró la reserva pendiente «${reservation.eventName}» en ${areaName}${countNote}.`,
    "No requiere autorización: la reserva ya quedó cancelada en el sistema.",
  ].join("\n");
  const html = `<p>${text.replace(/\n/g, "<br/>")}</p>`;

  const result = await sendMail({ to: adminEmails, subject, text, html });
  if (!result.sent) {
    console.info("[email] Aviso de retiro no enviado por correo.");
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
      "No hay administradores con correo válido para notificar. Revisa usuarios ADMIN en SQL (email + recibir correos de autorización).",
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
