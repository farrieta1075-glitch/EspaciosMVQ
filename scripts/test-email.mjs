import nodemailer from "nodemailer";

function smtpFromEnv() {
  const user = process.env.EMAIL_SMTP_USER?.trim();
  const pass = process.env.EMAIL_SMTP_PASSWORD?.trim()?.replace(/\s+/g, "");
  if (user && pass) {
    return {
      host: process.env.EMAIL_SMTP_HOST?.trim() || "smtp.gmail.com",
      port: Number(process.env.EMAIL_SMTP_PORT || 587),
      secure: process.env.EMAIL_SMTP_SECURE === "true",
      auth: { user, pass },
    };
  }

  const url = process.env.EMAIL_SERVER?.trim();
  if (!url) return null;

  const secure = url.startsWith("smtps://");
  const withoutProto = url.replace(/^smtps?:\/\//, "");
  const lastAt = withoutProto.lastIndexOf("@");
  const hostPort = withoutProto.slice(lastAt + 1);
  const userInfo = withoutProto.slice(0, lastAt);
  const colonIdx = userInfo.indexOf(":");
  let host = hostPort.replace(/:\d+$/, "");
  if (host === "gmail.com") {
    console.warn('Host "gmail.com" → usando smtp.gmail.com. Corrige EMAIL_SERVER (@smtp.gmail.com:587).');
    host = "smtp.gmail.com";
  }
  const portMatch = hostPort.match(/:(\d+)$/);
  const port = portMatch ? Number(portMatch[1]) : secure ? 465 : 587;

  return {
    host,
    port,
    secure,
    auth: {
      user: decodeURIComponent(userInfo.slice(0, colonIdx)),
      pass: userInfo.slice(colonIdx + 1).replace(/\s+/g, ""),
    },
  };
}

const smtp = smtpFromEnv();
if (!smtp) {
  console.error("Configura EMAIL_SMTP_USER/PASSWORD o EMAIL_SERVER en .env.local");
  process.exit(1);
}

const to = process.argv[2] || smtp.auth.user;
const transport = nodemailer.createTransport({
  ...smtp,
  family: 4,
  requireTLS: !smtp.secure && smtp.port === 587,
});

console.log("Verificando SMTP…", {
  host: smtp.host,
  port: smtp.port,
  user: smtp.auth.user,
});

try {
  await transport.verify();
  console.log("✓ Conexión SMTP OK");
} catch (e) {
  console.error("✗ verify() falló:", e.message);
  process.exit(1);
}

const from = process.env.EMAIL_FROM?.trim() || smtp.auth.user;
const info = await transport.sendMail({
  from,
  to,
  subject: "MVQro Espacios — prueba script",
  text: "Correo de prueba desde scripts/test-email.mjs",
});

console.log("✓ Enviado a", to, "messageId:", info.messageId);
