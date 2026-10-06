import "server-only";

export function isEmailTransportConfigured(): boolean {
  const user = process.env.EMAIL_SMTP_USER?.trim();
  const pass = process.env.EMAIL_SMTP_PASSWORD?.trim();
  if (user && pass) return true;
  return Boolean(process.env.EMAIL_SERVER?.trim());
}

function decodeSmtpCredential(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** user:pass@host:port — el usuario puede ser un correo con @ */
function parseSmtpServerUrl(serverUrl: string): {
  user: string;
  pass: string;
  host: string;
  port: number;
  secure: boolean;
} | null {
  const trimmed = serverUrl.trim();
  const secure = trimmed.startsWith("smtps://");
  const withoutProto = trimmed.replace(/^smtps?:\/\//, "");
  const lastAt = withoutProto.lastIndexOf("@");
  if (lastAt <= 0) return null;

  const hostPort = withoutProto.slice(lastAt + 1);
  const userInfo = withoutProto.slice(0, lastAt);
  const colonIdx = userInfo.indexOf(":");
  if (colonIdx <= 0) return null;

  const hostMatch = hostPort.match(/^([^:/]+)(?::(\d+))?$/);
  if (!hostMatch) return null;

  let host = hostMatch[1];
  const port = hostMatch[2]
    ? Number(hostMatch[2])
    : secure
      ? 465
      : 587;

  if (host === "gmail.com") {
    console.warn(
      '[email] El host SMTP es "gmail.com"; corrigiendo a "smtp.gmail.com". ' +
        "Revisa EMAIL_SERVER: debe terminar en @smtp.gmail.com:587 (no @gmail.com).",
    );
    host = "smtp.gmail.com";
  }

  return {
    user: decodeSmtpCredential(userInfo.slice(0, colonIdx)),
    pass: decodeSmtpCredential(userInfo.slice(colonIdx + 1)),
    host,
    port,
    secure,
  };
}

function smtpConfigFromEnv(): {
  user: string;
  pass: string;
  host: string;
  port: number;
  secure: boolean;
} | null {
  const explicitUser = process.env.EMAIL_SMTP_USER?.trim();
  const explicitPass = process.env.EMAIL_SMTP_PASSWORD?.trim();
  if (explicitUser && explicitPass) {
    const host = process.env.EMAIL_SMTP_HOST?.trim() || "smtp.gmail.com";
    const port = Number(process.env.EMAIL_SMTP_PORT?.trim() || "587");
    const secure =
      process.env.EMAIL_SMTP_SECURE === "true" ||
      port === 465 ||
      process.env.EMAIL_SERVER?.trim().startsWith("smtps://") === true;
    return {
      user: explicitUser,
      pass: explicitPass.replace(/\s+/g, ""),
      host,
      port,
      secure,
    };
  }

  const serverUrl = process.env.EMAIL_SERVER?.trim();
  if (!serverUrl) return null;

  const parsed = parseSmtpServerUrl(serverUrl);
  if (!parsed) return null;

  return {
    ...parsed,
    pass: parsed.pass.replace(/\s+/g, ""),
  };
}

/** Evita ETIMEDOUT por IPv6 cuando la red solo enruta IPv4. */
export async function createMailTransport() {
  const config = smtpConfigFromEnv();
  if (!config) return null;

  const nodemailer = await import("nodemailer");
  const forceIpv4 = process.env.EMAIL_SMTP_FORCE_IPV4 !== "false";
  const isGmail = config.host.includes("gmail.com");

  const secure = config.secure;
  const port = config.port;

  return nodemailer.createTransport({
    host: config.host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    ...(forceIpv4 ? { family: 4 as const } : {}),
    ...(isGmail
      ? {
          tls: {
            minVersion: "TLSv1.2",
          },
        }
      : {}),
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  });
}

export async function verifyMailTransport(): Promise<{
  ok: boolean;
  error?: string;
  user?: string;
  host?: string;
  port?: number;
}> {
  const config = smtpConfigFromEnv();
  if (!config) {
    return { ok: false, error: "SMTP no configurado (EMAIL_SMTP_* o EMAIL_SERVER)" };
  }

  try {
    const transport = await createMailTransport();
    if (!transport) {
      return { ok: false, error: "No se pudo crear el transporte SMTP" };
    }
    await transport.verify();
    return {
      ok: true,
      user: config.user,
      host: config.host,
      port: config.port,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      user: config.user,
      host: config.host,
      port: config.port,
    };
  }
}
