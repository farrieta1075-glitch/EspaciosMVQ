/**
 * Crea/actualiza tablas en Azure SQL (Prisma db push).
 * Requiere en .env.local:
 *   AZURE_SQL_USER=serveradmin
 *   AZURE_SQL_PASSWORD=...
 * Opcional: AZURE_SQL_SERVER, AZURE_SQL_DATABASE
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const server =
  process.env.AZURE_SQL_SERVER?.trim() ||
  "mvqro-sql.database.windows.net";
const database =
  process.env.AZURE_SQL_DATABASE?.trim() || "mvqroeventos-sql-db";
const user = process.env.AZURE_SQL_USER?.trim();
const password = process.env.AZURE_SQL_PASSWORD?.trim();

if (process.env.DATABASE_URL?.trim()) {
  console.log("Usando DATABASE_URL de .env.local");
} else if (!user || !password) {
  console.error(
    "Falta conexión: define DATABASE_URL o AZURE_SQL_USER + AZURE_SQL_PASSWORD en .env.local",
  );
  process.exit(1);
} else {
  const encodedPassword = encodeURIComponent(password);
  process.env.DATABASE_URL = `sqlserver://${server}:1433;database=${database};user=${encodeURIComponent(user)};password=${encodedPassword};encrypt=true;trustServerCertificate=false;`;
  console.log(`Conectando a ${server} / ${database} como ${user}`);
}

const result = spawnSync("npx", ["prisma", "db", "push", "--accept-data-loss"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
