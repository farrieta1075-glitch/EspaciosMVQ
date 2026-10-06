import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, unauthorizedResponse } from "@/lib/auth/api";
import { getAllAreas } from "@/lib/sheets/areas";
import {
  countActiveAdmins,
  deactivateUser,
  getUserById,
  updateUser,
} from "@/lib/sheets/users";
import type { PublicUser } from "@/types/user";

const updateUserSchema = z
  .object({
    email: z.string().optional().nullable(),
    username: z.string().min(2).optional().nullable(),
    password: z.string().min(6).optional(),
    role: z.enum(["ADMIN", "GENERAL", "VISUALIZACION"]).optional(),
    areaId: z.string().optional().nullable(),
    active: z.boolean().optional(),
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

async function enrichUser(user: NonNullable<Awaited<ReturnType<typeof getUserById>>>) {
  const areas = await getAllAreas();
  const areaMap = new Map(areas.map((area) => [area.id, area.name]));
  return toPublicUser({
    ...user,
    areaName: user.areaId ? areaMap.get(user.areaId) ?? null : null,
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const user = await getUserById(id);
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json(await enrichUser(user));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const existing = await getUserById(id);
  if (!existing) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const nextRole = parsed.data.role ?? existing.role;
  const nextAreaId =
    parsed.data.areaId !== undefined ? parsed.data.areaId : existing.areaId;
  const nextActive =
    parsed.data.active !== undefined ? parsed.data.active : existing.active;
  const nextEmail =
    parsed.data.email !== undefined ? parsed.data.email : existing.email;
  const nextUsername =
    parsed.data.username !== undefined ? parsed.data.username : existing.username;

  if (!nextEmail && !nextUsername) {
    return NextResponse.json(
      { error: "Indica al menos un correo o nombre de usuario." },
      { status: 400 },
    );
  }

  if (nextRole === "GENERAL" && !nextAreaId) {
    return NextResponse.json(
      { error: "Los usuarios General deben tener un área asignada." },
      { status: 400 },
    );
  }

  if (existing.role === "ADMIN" && nextRole !== "ADMIN" && nextActive) {
    const otherAdmins = await countActiveAdmins(id);
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "Debe existir al menos un administrador activo." },
        { status: 400 },
      );
    }
  }

  if (existing.role === "ADMIN" && nextActive === false) {
    const otherAdmins = await countActiveAdmins(id);
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "No puedes desactivar al único administrador." },
        { status: 400 },
      );
    }
  }

  if (id === session.user.id && nextActive === false) {
    return NextResponse.json(
      { error: "No puedes desactivar tu propia cuenta." },
      { status: 400 },
    );
  }

  try {
    const updated = await updateUser(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json(await enrichUser(updated));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el usuario",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const existing = await getUserById(id);
  if (!existing) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "No puedes desactivar tu propia cuenta." },
      { status: 400 },
    );
  }

  if (existing.role === "ADMIN" && existing.active) {
    const otherAdmins = await countActiveAdmins(id);
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "No puedes desactivar al único administrador." },
        { status: 400 },
      );
    }
  }

  const ok = await deactivateUser(id);
  if (!ok) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
