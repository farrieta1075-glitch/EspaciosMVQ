import "server-only";
import { createECDH } from "crypto";
import { getAppBaseUrl } from "@/lib/app-url";

export const DEFAULT_VAPID_SUBJECT = "mailto:soporte@mvqro.local";

export type VapidSubjectSource =
  | "WEB_PUSH_VAPID_SUBJECT"
  | "EMAIL_SMTP_USER"
  | "EMAIL_FROM"
  | "APP_URL"
  | "default";

/** Acepta correo sin prefijo mailto: o URL http → https para Apple. */
export function normalizeVapidSubject(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith("mailto:") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }

  if (trimmed.startsWith("http://")) {
    try {
      const url = new URL(trimmed);
      if (url.hostname) return `https://${url.host}`;
    } catch {
      /* ignore */
    }
  }

  return trimmed;
}

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

export function resolveVapidSubjectFromEnv(): {
  subject: string;
  source: VapidSubjectSource;
} {
  const explicit = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
  if (explicit) {
    return {
      subject: normalizeVapidSubject(explicit),
      source: "WEB_PUSH_VAPID_SUBJECT",
    };
  }

  const smtpUser = process.env.EMAIL_SMTP_USER?.trim();
  if (smtpUser && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpUser)) {
    return { subject: `mailto:${smtpUser}`, source: "EMAIL_SMTP_USER" };
  }

  const emailFrom = process.env.EMAIL_FROM?.trim();
  if (emailFrom) {
    const parsed = extractEmailFromFromHeader(emailFrom);
    if (parsed) {
      return { subject: `mailto:${parsed}`, source: "EMAIL_FROM" };
    }
  }

  try {
    const base = getAppBaseUrl();
    if (base.startsWith("https://")) {
      const url = new URL(base);
      if (url.hostname && !/^(localhost|127\.0\.0\.1)$/i.test(url.hostname)) {
        return { subject: url.origin, source: "APP_URL" };
      }
    }
  } catch {
    /* ignore */
  }

  const appUrl =
    process.env.APP_URL?.trim() || process.env.AUTH_URL?.trim() || "";
  if (appUrl) {
    const normalized = normalizeVapidSubject(appUrl);
    if (normalized.startsWith("https://")) {
      try {
        const url = new URL(normalized);
        if (url.hostname && !/^(localhost|127\.0\.0\.1)$/i.test(url.hostname)) {
          return { subject: url.origin, source: "APP_URL" };
        }
      } catch {
        /* ignore */
      }
    }
  }

  return { subject: DEFAULT_VAPID_SUBJECT, source: "default" };
}

export function getVapidSubjectFromEnv(): string {
  return resolveVapidSubjectFromEnv().subject;
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
  subjectSource: VapidSubjectSource;
  subjectAcceptable: boolean;
  usingDefaultSubject: boolean;
  publicKeyFingerprint: string;
  issues: string[];
};

export function getVapidServerDiagnostics(): VapidServerDiagnostics {
  const publicKey = getVapidPublicKeyFromEnv();
  const privateKey = getVapidPrivateKeyFromEnv();
  const { subject, source } = resolveVapidSubjectFromEnv();
  const configured = Boolean(publicKey && privateKey);
  const keysMatch = configured ? vapidKeysMatchInEnv() : false;
  const usingDefaultSubject = source === "default";
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
      "Define WEB_PUSH_VAPID_SUBJECT en Dokploy (mailto:correo real o https://tu-dominio). Sin comillas. Luego Reload del servicio.",
    );
    if (source !== "WEB_PUSH_VAPID_SUBJECT") {
      issues.push(
        `Subject actual viene de «${source}» y no es válido para iOS; conviene fijar WEB_PUSH_VAPID_SUBJECT explícitamente.`,
      );
    }
  }

  return {
    configured,
    keysMatch,
    subject,
    subjectSource: source,
    subjectAcceptable,
    usingDefaultSubject,
    publicKeyFingerprint: vapidPublicKeyFingerprint(publicKey),
    issues,
  };
}
