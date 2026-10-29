import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/index";
import { isAdmin } from "@/lib/auth/permissions";
import {
  collectEventPresetGroups,
  resolveUserAreaScopeIds,
} from "@/lib/area-scope";
import { getAllAreas } from "@/lib/sheets/areas";
import { getUserById } from "@/lib/sheets/users";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scopeParam = searchParams.get("scopeIds");
  const areas = await getAllAreas();

  let scopeIds: string[] = [];
  if (scopeParam) {
    scopeIds = scopeParam.split(",").map((id) => id.trim()).filter(Boolean);
  } else if (isAdmin(session.user)) {
    scopeIds = areas.map((area) => area.id);
  } else {
    const user = await getUserById(session.user.id);
    scopeIds = user ? resolveUserAreaScopeIds(user) : [];
  }

  const groups = collectEventPresetGroups(areas, scopeIds);
  return NextResponse.json({ scopeIds, groups });
}
