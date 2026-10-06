import "server-only";
import {
  createMailTransport,
  isEmailTransportConfigured,
} from "@/lib/email/mail-transport";

const debug = process.env.EMAIL_DEBUG === "true";

export async function sendMail(options: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; messageId?: string; skippedReason?: string }> {
  const recipients = (
    Array.isArray(options.to) ? options.to : [options.to]
  )
    .map((email) => email.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return { sent: false, skippedReason: "sin destinatarios" };
  }
  if (!isEmailTransportConfigured()) {
    const skippedReason = "SMTP no configurado";
    console.info(`[email] ${skippedReason}`);
    console.info(`[email] Para: ${recipients.join(", ")}`);
    console.info(options.text);
    return { sent: false, skippedReason };
  }

  const transport = await createMailTransport();
  if (!transport) {
    const skippedReason = "transporte SMTP inválido (revisa EMAIL_SERVER o EMAIL_SMTP_*)";
    console.warn(`[email] ${skippedReason}`);
    return { sent: false, skippedReason };
  }

  const from =
    process.env.EMAIL_FROM?.trim() ??
    "MVQro Espacios <no-reply@mvqro.local>";

  try {
    const mailOptions =
      recipients.length > 1
        ? {
            from,
            to: recipients[0],
            bcc: recipients.slice(1),
            subject: options.subject,
            text: options.text,
            html: options.html,
          }
        : {
            from,
            to: recipients[0],
            subject: options.subject,
            text: options.text,
            html: options.html,
          };

    const info = await transport.sendMail(mailOptions);

    if (debug || process.env.NODE_ENV !== "production") {
      console.info(
        `[email] Enviado a ${recipients.join(", ")} — messageId: ${info.messageId ?? "(sin id)"}`,
      );
    }

    return { sent: true, messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[email] Fallo al enviar a ${recipients.join(", ")}: ${message}`);
    throw error;
  }
}
