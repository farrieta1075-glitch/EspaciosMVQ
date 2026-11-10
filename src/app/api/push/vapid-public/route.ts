import { NextResponse } from "next/server";
import {
  getVapidPublicKeyFromEnv,
  vapidPublicKeyFingerprint,
} from "@/lib/push/vapid-config";

export const runtime = "nodejs";

/** Clave pública VAPID actual del servidor (evita depender solo del valor embebido en el build). */
export async function GET() {
  const publicKey = getVapidPublicKeyFromEnv();
  if (!publicKey) {
    return NextResponse.json(
      { error: "Push no configurado en el servidor." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      publicKey,
      fingerprint: vapidPublicKeyFingerprint(publicKey),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
