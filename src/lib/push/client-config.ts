export function isWebPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim());
}

export function getVapidPublicKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

/** Clave pública del servidor (no la embebida en build — evita claves Vercel viejas en Dokploy). */
export async function getVapidPublicKeyForSubscription(): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/push/vapid-public", {
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new Error(
      "No hay conexión con el servidor para leer la clave VAPID. Comprueba el dominio y la red.",
    );
  }

  if (!response.ok) {
    throw new Error(
      "El servidor no expuso la clave VAPID pública. Revisa NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en Dokploy.",
    );
  }

  const data = (await response.json()) as { publicKey?: string };
  const live = data.publicKey?.trim();
  if (!live) {
    throw new Error("Clave VAPID pública vacía en el servidor.");
  }

  const embedded = getVapidPublicKey();
  if (
    embedded &&
    embedded !== live &&
    process.env.NODE_ENV === "development"
  ) {
    console.warn(
      "[web-push] La clave embebida en build no coincide con /api/push/vapid-public; usando la del servidor.",
    );
  }

  return live;
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
