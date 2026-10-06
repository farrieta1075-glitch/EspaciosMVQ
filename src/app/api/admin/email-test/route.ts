import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/index";
import { isAdmin } from "@/lib/auth/permissions";
import { getAdminNotificationEmails } from "@/lib/email/admin-recipients";
import { verifyMailTransport } from "@/lib/email/mail-transport";
import { sendMail } from "@/lib/email/send-mail";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const [verify, recipients] = await Promise.all([
    verifyMailTransport(),
    getAdminNotificationEmails(),
  ]);

  return NextResponse.json({
    smtp: verify,
    adminRecipients: recipients.emails,
    skippedAdmins: recipients.skipped,
    yourSessionEmail: session.user.email ?? null,
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const to = session.user.email?.trim();
  if (!to) {
    return NextResponse.json(
      {
        error:
          "Tu usuario admin no tiene correo en la hoja Usuarios; no hay destino de prueba.",
      },
      { status: 400 },
    );
  }

  const verify = await verifyMailTransport();
  if (!verify.ok) {
    return NextResponse.json(
      { error: "SMTP no verificado", details: verify },
      { status: 502 },
    );
  }

  try {
    const result = await sendMail({
      to,
      subject: "MVQro Espacios — prueba de correo",
      text: "Si lees esto, el envío SMTP funciona correctamente.",
      html: "<p>Si lees esto, el envío SMTP funciona correctamente.</p>",
    });
    return NextResponse.json({ ok: true, to, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error al enviar",
      },
      { status: 502 },
    );
  }
}
