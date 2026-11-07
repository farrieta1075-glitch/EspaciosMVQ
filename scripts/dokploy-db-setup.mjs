/**
 * Ejecutar dentro del contenedor Dokploy (Terminal), con DATABASE_URL ya definida.
 *
 *   npm run db:setup:prod
 *   npm run db:setup:prod:fresh   # vacía Postgres antes de copiar datos
 *
 * Para copiar desde Azure, añade en Dokploy (temporal):
 *   AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, AZURE_SQL_PASSWORD
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

function run(label, command, args) {
  console.log(`\n→ ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`Falló: ${label}`);
    process.exit(result.status ?? 1);
  }
}

const dbUrl = process.env.DATABASE_URL?.trim() ?? "";
if (!dbUrl.startsWith("postgres")) {
  console.error(
    "Falta DATABASE_URL de PostgreSQL en el entorno de Dokploy (no uses .env.local aquí).",
  );
  process.exit(1);
}

const prismaCli = resolve(process.cwd(), "node_modules/prisma/build/index.js");
const prismaArgs = existsSync(prismaCli)
  ? ["node", [prismaCli, "db", "push"]]
  : ["npx", ["prisma", "db", "push"]];

run("Crear/actualizar tablas (Prisma)", prismaArgs[0], prismaArgs[1]);

const azureUser = process.env.AZURE_SQL_USER?.trim();
if (!azureUser) {
  console.log(
    "\nEstructura lista. Para copiar datos desde Azure SQL, define AZURE_SQL_* y ejecuta:\n  npm run db:migrate-from-azure\n",
  );
  process.exit(0);
}

const migrateArgs = ["scripts/migrate-azure-sql-to-postgres.mjs"];
if (process.argv.includes("--truncate")) {
  migrateArgs.push("--truncate");
}

run("Copiar datos Azure SQL → Postgres", "node", migrateArgs);
console.log("\nListo: estructura + datos.");
