import { NextResponse } from "next/server";
import { runEventReminderJob } from "@/lib/event-reminders";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await runEventReminderJob();
  return NextResponse.json({ ok: true, ...result });
}
