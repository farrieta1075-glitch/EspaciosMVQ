import "server-only";

/** URL pública de la app (correos, enlaces de aprobación). */
export function getAppBaseUrl(): string {
  const explicit = process.env.AUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.startsWith("http") ? vercel : `https://${vercel}`;
    return host.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}
