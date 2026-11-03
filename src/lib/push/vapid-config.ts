import "server-only";
import { createECDH } from "crypto";

export const DEFAULT_VAPID_SUBJECT = "mailto:soporte@mvqro.local";

export function getVapidPublicKeyFromEnv(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

export function getVapidPrivateKeyFromEnv(): string {
  return process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
}

export function getVapidSubjectFromEnv(): string {
  return (
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT
  );
}

function base64UrlToBuffer(value: string): Buffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

/** true si la clave privada de Vercel corresponde a la pública embebida en la app. */
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
  const usingDefaultSubject = subject === DEFAULT_VAPID_SUBJECT;
  const subjectAcceptable = isVapidSubjectAcceptableForApple(subject);

  const issues: string[] = [];
  if (!configured) {
    issues.push("Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY en Vercel.");
  } else if (!keysMatch) {
    issues.push(
      "La clave privada no corresponde a la pública: genera un par con npm run generate:vapid, pon ambas en Vercel y vuelve a desplegar.",
    );
  }
  if (!subjectAcceptable) {
    issues.push(
      "WEB_PUSH_VAPID_SUBJECT debe ser mailto:correo@tudominio.com (correo real) o https://tudominio.com. iOS no acepta el valor por defecto.",
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
