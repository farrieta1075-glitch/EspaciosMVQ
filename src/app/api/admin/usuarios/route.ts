import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import { getAllAreas } from "@/lib/sheets/areas";
import {
  createUser,
  getAllUserRecords,
} from "@/lib/sheets/users";
import type { PublicUser } from "@/types/user";

const createUserSchema = z
  .object({
    email: z.string().optional().nullable(),
    username: z.string().min(2).optional().nullable(),
    password: z.string().min(6),
    role: z.enum(["ADMIN", "GENERAL", "VISUALIZACION"]),
    areaId: z.string().optional().nullable(),
    active: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.email?.trim()) {
      const result = z.string().email().safeParse(data.email.trim());
      if (!result.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Correo inválido",
          path: ["email"],
        });
      }
    }
  });

function toPublicUser(user: {
  id: string;
  email: string | null;
  username: string | null;
  role: PublicUser["role"];
  areaId: string | null;
  active: boolean;
  areaName?: string | null;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    areaId: user.areaId,
    active: user.active,
    areaName: user.areaName,
  };
}

async function enrichUsers(users: Awaited<ReturnType<typeof getAllUserRecords>>) {
  const areas = await getAllAreas();
  const areaMap = new Map(areas.map((area) => [area.id, area.name]));
  return users.map((user) =>
    toPublicUser({
      ...user,
      areaName: user.areaId ? areaMap.get(user.areaId) ?? null : null,
    }),
  );
}

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const users = await enrichUsers(await getAllUserRecords());
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, username, password, role, areaId, active } = parsed.data;
  if (!email && !username) {
    return NextResponse.json(
      { error: "Indica al menos un correo o nombre de usuario." },
      { status: 400 },
    );
  }

  if (role === "GENERAL" && !areaId) {
    return NextResponse.json(
      { error: "Los usuarios General deben tener un área asignada." },
      { status: 400 },
    );
  }

  try {
    const user = await createUser({
      email,
      username,
      password,
      role,
      areaId,
      active,
    });
    const [publicUser] = await enrichUsers([user]);
    return NextResponse.json(publicUser, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo crear el usuario",
      },
      { status: 400 },
    );
  }
}
