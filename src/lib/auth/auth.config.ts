import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/types/user";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: UserRole;
      areaId?: string | null;
    };
  }

  interface User {
    role: UserRole;
    areaId?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: UserRole;
    areaId?: string | null;
  }
}

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.areaId = user.areaId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role ?? "VISUALIZACION";
        session.user.areaId = token.areaId ?? null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
