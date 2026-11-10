import "server-only";
import { createECDH } from "crypto";

export const DEFAULT_VAPID_SUBJECT = "mailto:soporte@mvqro.local";

export function getVapidPublicKeyFromEnv(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

export function getVapidPrivateKeyFromEnv(): string {
  return process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
}

function extractEmailFromFromHeader(value: string): string | null {
  const trimmed = value.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : trimmed).trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
    return candidate;
  }
  return null;
}

/** Si no hay WEB_PUSH_VAPID_SUBJECT, usa el correo de envío o la URL pública (válido para iOS). */
function deriveVapidSubjectFallback(): string {
  const smtpUser = process.env.EMAIL_SMTP_USER?.trim();
  if (smtpUser && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpUser)) {
    return `mailto:${smtpUser}`;
  }

  const emailFrom = process.env.EMAIL_FROM?.trim();
  if (emailFrom) {
    const parsed = extractEmailFromFromHeader(emailFrom);
    if (parsed) return `mailto:${parsed}`;
  }

  const appUrl =
    process.env.APP_URL?.trim() || process.env.AUTH_URL?.trim() || "";
  if (appUrl.startsWith("https://")) {
    try {
      const url = new URL(appUrl);
      if (url.hostname && !/^(localhost|127\.0\.0\.1)$/i.test(url.hostname)) {
        return url.origin;
      }
    } catch {
      /* ignore */
    }
  }

  return DEFAULT_VAPID_SUBJECT;
}

export function getVapidSubjectFromEnv(): string {
  const explicit = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
  if (explicit) return explicit;
  return deriveVapidSubjectFallback();
}

function base64UrlToBuffer(value: string): Buffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

/** true si la clave privada del servidor corresponde a la pública embebida en la app. */
export function vapidKeysMatchInEnv(): boolean {
  const publicKey = getVapidPublicKeyFromEnv();
  const privateKey = getVapidPrivateKeyFromEnv();
  if (!publicKey || !privateKey) return false;

  try {
    const privateBytes = base64UrlToBuffer(privateKey);
    const publicBytes = base64UrlToBuffer(publicKey);
    if (privateBytes.length !== 32 || publicBytes.length !== 65) {
      return false;
    }
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(privateBytes);
    const derived = ecdh.getPublicKey(null, "uncompressed");
    return derived.equals(publicBytes);
  } catch {
    return false;
  }
}

/** Apple suele rechazar subjects placeholder (.local) o mailto mal formado. */
export function isVapidSubjectAcceptableForApple(subject: string): boolean {
  const trimmed = subject.trim();
  if (trimmed.startsWith("mailto:")) {
    const email = trimmed.slice("mailto:".length).trim();
    if (!email || email.includes(".local")) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  if (trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      return url.protocol === "https:" && Boolean(url.hostname);
    } catch {
      return false;
    }
  }
  return false;
}

export function vapidPublicKeyFingerprint(publicKey?: string): string {
  const key = (publicKey ?? getVapidPublicKeyFromEnv()).trim();
  if (key.length < 16) return "";
  return `${key.slice(0, 6)}…${key.slice(-6)}`;
}

export type VapidServerDiagnostics = {
  configured: boolean;
  keysMatch: boolean;
  subject: string;
  subjectAcceptable: boolean;
  usingDefaultSubject: boolean;
  publicKeyFingerprint: string;
  issues: string[];
};

export function getVapidServerDiagnostics(): VapidServerDiagnostics {
  const publicKey = getVapidPublicKeyFromEnv();
  const privateKey = getVapidPrivateKeyFromEnv();
  const subject = getVapidSubjectFromEnv();
  const configured = Boolean(publicKey && privateKey);
  const keysMatch = configured ? vapidKeysMatchInEnv() : false;
  const usingDefaultSubject =
    !process.env.WEB_PUSH_VAPID_SUBJECT?.trim() &&
    subject === DEFAULT_VAPID_SUBJECT;
  const subjectAcceptable = isVapidSubjectAcceptableForApple(subject);

  const issues: string[] = [];
  if (!configured) {
    issues.push(
      "Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY en el servidor (Dokploy). La pública requiere Rebuild.",
    );
  } else if (!keysMatch) {
    issues.push(
      "La clave privada no corresponde a la pública: genera un par con npm run generate:vapid, define ambas en Dokploy y haz Rebuild.",
    );
  }
  if (!subjectAcceptable) {
    issues.push(
      "WEB_PUSH_VAPID_SUBJECT debe ser mailto:correo real o https://tu-dominio. iOS rechaza mailto:...@....local. Defínela en Dokploy (o usa EMAIL_SMTP_USER con correo válido).",
    );
  }

  return {
    configured,
    keysMatch,
    subject,
    subjectAcceptable,
    usingDefaultSubject,
    publicKeyFingerprint: vapidPublicKeyFingerprint(publicKey),
    issues,
  };
}
