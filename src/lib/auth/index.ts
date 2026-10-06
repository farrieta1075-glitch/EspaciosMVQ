import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/lib/auth/auth.config";
import {
  findUserByEmail,
  findUserByUsername,
  toSessionUser,
  verifyUserPassword,
} from "@/lib/auth/users";

const credentialsSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Usuario y contraseña",
      credentials: {
        login: { label: "Usuario o correo", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const { login, password } = parsed.data;
          const isEmail = login.includes("@");
          const user = isEmail
            ? await findUserByEmail(login)
            : await findUserByUsername(login);

          if (!user || !user.active) return null;

          const valid = await verifyUserPassword(user, password);
          if (!valid) return null;

          return toSessionUser(user);
        } catch (error) {
          console.error("[auth] Error al validar credenciales:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn() {
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.areaId = user.areaId;
        if (user.id) token.sub = user.id;
      }
      return token;
    },
    session: authConfig.callbacks.session,
  },
});
