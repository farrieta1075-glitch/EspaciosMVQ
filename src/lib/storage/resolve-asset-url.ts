/**
 * Convierte la URL guardada en Sheets a una URL usable en el navegador.
 * - Local: /uploads/...
 * - Blob privado: blob:maps/... → /api/storage/maps/...
 * - Blob público: https://....vercel-storage.com/...
 */
export function resolveAssetUrl(stored: string | null | undefined): string {
  if (!stored) return "";

  const value = stored.trim();
  if (!value) return "";

  if (value.startsWith("blob:")) {
    return `/api/storage/${value.slice("blob:".length)}`;
  }

  if (value.startsWith("/uploads/")) {
    if (process.env.NODE_ENV === "development") {
      return value;
    }
    return `/api/storage/${value.slice("/uploads/".length)}`;
  }

  if (
    value.startsWith("maps/") ||
    value.startsWith("resources/")
  ) {
    return `/api/storage/${value}`;
  }

  return value;
}
