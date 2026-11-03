import "server-only";
import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrlEnv } from "@/lib/db/config";
import { isTransientDbError, withDbRetry } from "@/lib/db/sql-transient";

type ExtendedPrisma = ReturnType<typeof buildPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrisma | undefined;
};

async function reconnectPrisma(client: ExtendedPrisma): Promise<void> {
  await client.$disconnect().catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 400));
  await client.$connect().catch(() => {});
}

function buildPrismaClient() {
  const base = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        return withDbRetry(() => query(args), {
          onRetry: async (attempt, error) => {
            if (isTransientDbError(error)) {
              console.warn(
                `[db] Reintento ${attempt} (Azure SQL / conexión):`,
                error instanceof Error ? error.message.slice(0, 200) : error,
              );
            }
            const client = globalForPrisma.prisma;
            if (client) {
              await reconnectPrisma(client);
            }
          },
        });
      },
    },
  });
}

export function getPrisma(): ExtendedPrisma {
  ensureDatabaseUrlEnv();
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = buildPrismaClient();
  }
  return globalForPrisma.prisma;
}
