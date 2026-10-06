/**
 * Convierte la URL guardada en Sheets a una URL usable en el navegador.
 * - Local dev: /uploads/...
 * - Blob privado: blob:maps/... → /api/storage/maps/...
 * - Rutas legacy /uploads/ en producción → /api/storage/...
 * - URLs de vercel-storage → /api/storage/... (proxy con token del servidor)
 */
function pathnameFromStoredValue(value: string): string | null {
  if (value.startsWith("blob:")) {
    return value.slice("blob:".length);
  }

  if (value.startsWith("/uploads/")) {
    return value.slice("/uploads/".length);
  }

  if (value.startsWith("maps/") || value.startsWith("resources/")) {
    return value;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const { pathname } = new URL(value);
      const normalized = pathname.replace(/^\/+/, "");
      if (normalized.startsWith("maps/") || normalized.startsWith("resources/")) {
        return normalized;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function resolveAssetUrl(stored: string | null | undefined): string {
  if (!stored) return "";

  const value = stored.trim();
  if (!value) return "";

  const pathname = pathnameFromStoredValue(value);
  if (pathname) {
    if (process.env.NODE_ENV === "development" && value.startsWith("/uploads/")) {
      return value;
    }
    return `/api/storage/${pathname}`;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return value;
}
