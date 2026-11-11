import "server-only";
import { createECDH } from "crypto";
import webpush from "web-push";
import { getAppBaseUrl } from "@/lib/app-url";

export const DEFAULT_VAPID_SUBJECT = "mailto:soporte@mvqro.local";

export type VapidSubjectSource =
  | "WEB_PUSH_VAPID_SUBJECT"
  | "EMAIL_SMTP_USER"
  | "EMAIL_FROM"
  | "APP_URL"
  | "default";

const EXPLICIT_VAPID_SUBJECT_ENV_KEYS = [
  "WEB_PUSH_VAPID_SUBJECT",
  "VAPID_SUBJECT",
] as const;

export function sanitizeEnvString(value: string): string {
  let v = value.replace(/^\uFEFF/, "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

export function readExplicitVapidSubjectRawFromEnv(): string {
  for (const key of EXPLICIT_VAPID_SUBJECT_ENV_KEYS) {
    const raw = process.env[key];
    if (raw?.trim()) {
      return sanitizeEnvString(raw);
    }
  }
  return "";
}

/** Acepta correo sin prefijo mailto:, comillas o «Nombre <correo>». */
export function normalizeVapidSubject(raw: string): string {
  const trimmed = sanitizeEnvString(raw);
  if (!trimmed) return trimmed;

  const fromHeader = extractEmailFromFromHeader(trimmed);
  if (fromHeader) {
    return `mailto:${fromHeader}`;
  }

  const mailtoMatch = trimmed.match(/^mailto:\s*(.+)$/i);
  if (mailtoMatch) {
    const email = sanitizeEnvString(mailtoMatch[1]);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return `mailto:${email}`;
    }
  }

  if (trimmed.toLowerCase().startsWith("https://")) {
    return trimmed;
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }

  if (trimmed.toLowerCase().startsWith("http://")) {
    try {
      const url = new URL(trimmed);
      if (url.hostname) return `https://${url.host}`;
    } catch {
      /* ignore */
    }
  }

  return trimmed;
}

function sanitizeVapidKey(value: string): string {
  let key = sanitizeEnvString(value);
  key = key.replace(/\\n/g, "").replace(/\s+/g, "");
  return key;
}

export function getVapidPublicKeyFromEnv(): string {
  const raw = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  return sanitizeVapidKey(raw);
}

export function getVapidPrivateKeyFromEnv(): string {
  const raw = process.env.VAPID_PRIVATE_KEY ?? "";
  return sanitizeVapidKey(raw);
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
  const explicit = readExplicitVapidSubjectRawFromEnv();
  if (explicit) {
    return {
      subject: normalizeVapidSubject(explicit),
      source: "WEB_PUSH_VAPID_SUBJECT",
    };
  }

  const smtpUser = sanitizeEnvString(process.env.EMAIL_SMTP_USER ?? "");
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
  if (/^mailto:/i.test(trimmed)) {
    const email = sanitizeEnvString(trimmed.replace(/^mailto:\s*/i, ""));
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

export function maskVapidSubjectPreview(subject: string): string {
  if (/^mailto:/i.test(subject)) {
    const email = sanitizeEnvString(subject.replace(/^mailto:\s*/i, ""));
    const at = email.indexOf("@");
    if (at <= 0) return "mailto:(mal formado)";
    return `mailto:${email.slice(0, Math.min(2, at))}…@${email.slice(at + 1)}`;
  }
  try {
    return new URL(subject).origin;
  } catch {
    return "(inválido)";
  }
}

export type VapidEnvProbe = {
  explicitSubjectDefined: boolean;
  explicitSubjectRawLength: number;
  subjectPreview: string;
};

export function getVapidEnvProbe(): VapidEnvProbe {
  const raw = readExplicitVapidSubjectRawFromEnv();
  const { subject } = resolveVapidSubjectFromEnv();
  return {
    explicitSubjectDefined: raw.length > 0,
    explicitSubjectRawLength: raw.length,
    subjectPreview: maskVapidSubjectPreview(subject),
  };
}

/** Firma un JWT VAPID para Apple; detecta clave privada corrupta en Dokploy. */
export function runVapidJwtSelfTest(): { ok: boolean; error?: string } {
  try {
    const subject = getVapidSubjectFromEnv();
    const publicKey = getVapidPublicKeyFromEnv();
    const privateKey = getVapidPrivateKeyFromEnv();
    if (!publicKey || !privateKey) {
      return { ok: false, error: "Faltan claves VAPID." };
    }
    if (!isVapidSubjectAcceptableForApple(subject)) {
      return { ok: false, error: "Subject VAPID no válido para iOS." };
    }
    const headers = webpush.getVapidHeaders(
      "https://web.push.apple.com",
      subject,
      publicKey,
      privateKey,
      "aes128gcm",
    );
    if (!String(headers.Authorization ?? "").startsWith("vapid t=")) {
      return { ok: false, error: "No se generó JWT VAPID." };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error generando JWT VAPID.",
    };
  }
}

export type VapidServerDiagnostics = {
  configured: boolean;
  keysMatch: boolean;
  jwtSelfTestOk: boolean;
  jwtSelfTestError?: string;
  subject: string;
  subjectSource: VapidSubjectSource;
  subjectAcceptable: boolean;
  usingDefaultSubject: boolean;
  publicKeyFingerprint: string;
  envProbe: VapidEnvProbe;
  issues: string[];
};

export function getVapidServerDiagnostics(): VapidServerDiagnostics {
  const publicKey = getVapidPublicKeyFromEnv();
  const privateKey = getVapidPrivateKeyFromEnv();
  const { subject, source } = resolveVapidSubjectFromEnv();
  const configured = Boolean(publicKey && privateKey);
  const keysMatch = configured ? vapidKeysMatchInEnv() : false;
  const selfTest = configured && keysMatch ? runVapidJwtSelfTest() : { ok: false };
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
  } else if (!selfTest.ok) {
    issues.push(
      `La clave privada en Dokploy parece corrupta (JWT VAPID no se genera). Pega de nuevo VAPID_PRIVATE_KEY en una sola línea, sin comillas. Detalle: ${selfTest.error ?? "error"}`,
    );
  }
  const envProbe = getVapidEnvProbe();

  if (!subjectAcceptable) {
    if (envProbe.explicitSubjectDefined) {
      issues.push(
        `WEB_PUSH_VAPID_SUBJECT llegó al servidor (${envProbe.explicitSubjectRawLength} caracteres) pero no es válido. Usa solo el correo (ej. tu@gmail.com) o mailto:tu@gmail.com, sin comillas.`,
      );
      issues.push(
        `Subject que interpreta el servidor: ${envProbe.subjectPreview}.`,
      );
    } else if (source !== "WEB_PUSH_VAPID_SUBJECT") {
      issues.push(
        `El servidor no ve WEB_PUSH_VAPID_SUBJECT (origen actual: «${source}»). En Dokploy añádela al servicio de la app, guarda y pulsa Reload o Redeploy del contenedor.`,
      );
      issues.push(
        `Subject en uso: ${envProbe.subjectPreview} (no válido para iOS).`,
      );
    } else {
      issues.push(
        "Define WEB_PUSH_VAPID_SUBJECT en Dokploy (solo correo o mailto:correo, sin comillas). Luego Reload del servicio.",
      );
    }
  }

  return {
    configured,
    keysMatch,
    jwtSelfTestOk: selfTest.ok,
    jwtSelfTestError: selfTest.error,
    subject,
    subjectSource: source,
    subjectAcceptable,
    usingDefaultSubject,
    publicKeyFingerprint: vapidPublicKeyFingerprint(publicKey),
    envProbe,
    issues,
  };
}
