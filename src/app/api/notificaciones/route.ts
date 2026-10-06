import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/index";
import {
  deleteNotificationForUser,
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/sheets/notifications";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const notifications = await getNotificationsForUser(session.user.id);
  const unreadCount = notifications.filter((item) => !item.read).length;
  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  if (body.markAllRead) {
    await markAllNotificationsRead(session.user.id);
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    await markNotificationRead(body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const deleted = await deleteNotificationForUser(id, session.user.id);
  if (!deleted) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
