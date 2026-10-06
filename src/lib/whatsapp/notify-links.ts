import "server-only";

/** Números en formato internacional sin + (ej. México: 5214421234567). */
export function getWhatsAppNotifyPhones(): string[] {
  const raw = process.env.WHATSAPP_NOTIFY_PHONES?.trim();
  if (!raw) return [];

  return raw
    .split(/[,;\s]+/)
    .map((part) => part.replace(/\D/g, ""))
    .filter((digits) => digits.length >= 10);
}

export function buildWhatsAppMeUrl(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppNotifyLinks(message: string): string[] {
  return getWhatsAppNotifyPhones().map((phone) =>
    buildWhatsAppMeUrl(phone, message),
  );
}
