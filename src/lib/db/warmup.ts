import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import { isSqlDatabaseEnabled } from "@/lib/db/config";
import { withDbRetry } from "@/lib/db/sql-transient";

export async function warmupDatabase(): Promise<{ ok: boolean; ms: number }> {
  if (!isSqlDatabaseEnabled()) {
    return { ok: false, ms: 0 };
  }
  const started = Date.now();
  await withDbRetry(async () => {
    await getPrisma().$queryRaw`SELECT 1 AS ok`;
  });
  return { ok: true, ms: Date.now() - started };
}
