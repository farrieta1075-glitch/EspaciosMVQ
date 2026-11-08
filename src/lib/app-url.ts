import "server-only";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function isLocalDevUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(
    url.trim(),
  );
}

/** URL pública de la app (correos, enlaces de aprobación, Auth.js). */
export function getAppBaseUrl(): string {
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) return normalizeBaseUrl(appUrl);

  const authUrl = process.env.AUTH_URL?.trim();
  const inProduction = process.env.NODE_ENV === "production";
  if (authUrl && !(inProduction && isLocalDevUrl(authUrl))) {
    return normalizeBaseUrl(authUrl);
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.startsWith("http") ? vercel : `https://${vercel}`;
    return normalizeBaseUrl(host);
  }

  return "http://localhost:3000";
}
