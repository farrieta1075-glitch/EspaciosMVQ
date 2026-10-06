import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/index";
import { getEventSuggestions } from "@/lib/sheets/event-history";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const suggestions = await getEventSuggestions(q, session.user.areaId);
  return NextResponse.json(suggestions);
}
