import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/index";
import { isAdmin } from "@/lib/auth/permissions";
import {
  buildEventPresetAreaOptions,
  buildPresetsByAreaId,
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
  const admin = isAdmin(session.user);
  const user = admin ? null : await getUserById(session.user.id);
  const allowed = admin
    ? null
    : new Set(user ? resolveUserAreaScopeIds(user, areas) : []);

  let scopeIds: string[] = [];
  if (scopeParam) {
    const requested = scopeParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    scopeIds = allowed
      ? requested.filter((id) => allowed.has(id))
      : requested;
  } else if (admin) {
    scopeIds = areas.map((area) => area.id);
  } else {
    scopeIds = allowed ? [...allowed] : [];
  }

  const areaOptions = buildEventPresetAreaOptions(areas, scopeIds);
  const presetsByAreaId = buildPresetsByAreaId(areas, scopeIds);
  const groups = collectEventPresetGroups(areas, scopeIds);

  return NextResponse.json({
    scopeIds,
    areaOptions,
    presetsByAreaId,
    groups,
  });
}
