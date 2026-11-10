export function isWebPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim());
}

export function getVapidPublicKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

/** Usa la clave del servidor si está disponible (tras cambios en Dokploy sin rebuild). */
export async function getVapidPublicKeyForSubscription(): Promise<string> {
  const embedded = getVapidPublicKey();
  try {
    const response = await fetch("/api/push/vapid-public", {
      cache: "no-store",
    });
    if (response.ok) {
      const data = (await response.json()) as { publicKey?: string };
      const live = data.publicKey?.trim();
      if (live) return live;
    }
  } catch {
    /* sin red: embebida */
  }
  return embedded;
}

export function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
