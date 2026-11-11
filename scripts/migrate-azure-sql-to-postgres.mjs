/**
 * Copia todos los datos Azure SQL → PostgreSQL en orden de dependencias lógicas.
 *
 * Requisitos:
 *   - Tablas destino ya creadas: npm run db:push  (con DATABASE_URL = Postgres)
 *   - Origen: AZURE_SQL_* o SOURCE_DATABASE_URL (sqlserver://...)
 *   - Destino: POSTGRES_URL o DATABASE_URL=postgresql://...
 *
 * Requiere instalar mssql temporalmente (no está en package.json):
 *   npm install --no-save mssql
 *
 * Uso:
 *   node --env-file=.env.local scripts/migrate-azure-sql-to-postgres.mjs
 *   node --env-file=.env.local scripts/migrate-azure-sql-to-postgres.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-azure-sql-to-postgres.mjs --truncate
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import sql from "mssql";
import { PrismaClient } from "@prisma/client";

/**
 * Orden respetando referencias lógicas (Prisma no declara FK, pero los IDs sí existen).
 * 1 Áreas (padre→hijo), usuarios (areaId), mapas, recursos
 * 2 Espacios (mapId)
 * 3 ResourceSpaces (resourceId, spaceId)
 * 4 Reservas (userId, areaId)
 * 5 ReservationResources, historial, notificaciones, push, logs
 */
const TABLE_PIPELINE = [
  { sqlTable: "Areas", prisma: "area", sortAreas: true },
  { sqlTable: "Users", prisma: "user", sortAreas: false },
  { sqlTable: "Maps", prisma: "floorMap", sortAreas: false },
  { sqlTable: "Resources", prisma: "resource", sortAreas: false },
  { sqlTable: "Spaces", prisma: "space", sortAreas: false },
  { sqlTable: "ResourceSpaces", prisma: "resourceSpace", sortAreas: false },
  { sqlTable: "Reservations", prisma: "reservation", sortAreas: false },
  {
    sqlTable: "ReservationResources",
    prisma: "reservationResource",
    sortAreas: false,
  },
  { sqlTable: "EventHistory", prisma: "eventHistory", sortAreas: false },
  { sqlTable: "Notifications", prisma: "notification", sortAreas: false },
  { sqlTable: "PushSubscriptions", prisma: "pushSubscription", sortAreas: false },
  { sqlTable: "UserActivityLogs", prisma: "userActivityLog", sortAreas: false },
];

const TRUNCATE_REVERSE = [
  "userActivityLog",
  "pushSubscription",
  "notification",
  "eventHistory",
  "reservationResource",
  "reservation",
  "resourceSpace",
  "space",
  "resource",
  "floorMap",
  "user",
  "area",
];

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

function resolvePostgresUrl() {
  const postgres =
    process.env.POSTGRES_URL?.trim() ||
    (process.env.DATABASE_URL?.trim().startsWith("postgres")
      ? process.env.DATABASE_URL.trim()
      : "");
  if (!postgres) {
    throw new Error(
      "Define POSTGRES_URL o DATABASE_URL=postgresql://... (destino).",
    );
  }
  return postgres;
}

function resolveAzureConfig() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL?.trim();
  if (sourceUrl?.startsWith("sqlserver://")) {
    return parseSqlServerUrl(sourceUrl);
  }

  const user = process.env.AZURE_SQL_USER?.trim();
  const password = process.env.AZURE_SQL_PASSWORD?.trim();
  const server =
    process.env.AZURE_SQL_SERVER?.trim() || "mvqro-sql.database.windows.net";
  const database =
    process.env.AZURE_SQL_DATABASE?.trim() || "mvqroeventos-sql-db";

  if (!user || !password) {
    throw new Error(
      "Faltan AZURE_SQL_USER y AZURE_SQL_PASSWORD (origen Azure SQL).",
    );
  }

  return {
    server,
    database,
    user,
    password,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
  };
}

function parseSqlServerUrl(url) {
  const withoutProto = url.replace(/^sqlserver:\/\//i, "");
  const parts = {};
  for (const segment of withoutProto.split(";")) {
    if (!segment.trim()) continue;
    if (segment.includes("=")) {
      const [k, ...rest] = segment.split("=");
      parts[k.trim().toLowerCase()] = rest.join("=").trim();
    } else if (!parts.server) {
      const [host, port] = segment.split(":");
      parts.server = host;
      parts.port = port ? Number(port) : 1433;
    }
  }
  return {
    server: parts.server,
    port: parts.port || 1433,
    database: parts.database,
    user: decodeURIComponent(parts.user || ""),
    password: decodeURIComponent(parts.password || ""),
    options: {
      encrypt: String(parts.encrypt ?? "true").toLowerCase() !== "false",
      trustServerCertificate:
        String(parts.trustservercertificate ?? "false").toLowerCase() === "true",
    },
  };
}

function normalizeRow(row) {
  const out = { ...row };
  for (const [key, value] of Object.entries(out)) {
    if (value === null || value === undefined) continue;
    if (value instanceof Date) continue;
    if (typeof value === "boolean" || typeof value === "number") continue;
    if (typeof value === "string") continue;
    if (Buffer.isBuffer(value)) {
      out[key] = value.toString("utf8");
    }
  }
  return out;
}

function sortAreasByParent(rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const sorted = [];
  const seen = new Set();

  function visit(row) {
    if (seen.has(row.id)) return;
    const parentId = row.parentId?.trim();
    if (parentId && byId.has(parentId) && !seen.has(parentId)) {
      visit(byId.get(parentId));
    }
    seen.add(row.id);
    sorted.push(row);
  }

  for (const row of rows) {
    visit(row);
  }
  return sorted;
}

async function fetchTable(pool, tableName) {
  const safe = tableName.replace(/\]/g, "]]");
  const result = await pool.request().query(`SELECT * FROM [${safe}]`);
  return result.recordset.map(normalizeRow);
}

async function insertBatch(prisma, model, rows, dryRun) {
  if (rows.length === 0) return 0;
  if (dryRun) return rows.length;

  const delegate = prisma[model];
  if (!delegate?.createMany) {
    throw new Error(`Modelo Prisma desconocido: ${model}`);
  }

  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const result = await delegate.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    inserted += result.count;
  }
  return inserted;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const truncate = process.argv.includes("--truncate");

  const postgresUrl = resolvePostgresUrl();
  process.env.DATABASE_URL = postgresUrl;

  const prisma = new PrismaClient();
  const azureConfig = resolveAzureConfig();
  const pool = await sql.connect(azureConfig);

  console.log("Origen:", azureConfig.server, azureConfig.database);
  console.log("Destino: PostgreSQL");
  if (dryRun) console.log("Modo: dry-run (sin escribir en Postgres)\n");
  else console.log("");

  if (truncate && !dryRun) {
    console.log("Vaciando tablas destino (orden inverso a dependencias)…");
    for (const model of TRUNCATE_REVERSE) {
      const delegate = prisma[model];
      if (delegate?.deleteMany) {
        const { count } = await delegate.deleteMany();
        if (count > 0) console.log(`  ${model}: ${count} filas`);
      }
    }
    console.log("");
  }

  for (const step of TABLE_PIPELINE) {
    let rows = await fetchTable(pool, step.sqlTable);
    if (step.sortAreas) {
      rows = sortAreasByParent(rows);
    }

    if (rows.length === 0) {
      console.log(`${step.sqlTable}: 0 filas en origen`);
      continue;
    }

    const written = await insertBatch(
      prisma,
      step.prisma,
      rows,
      dryRun,
    );
    const label = dryRun ? "se copiarían" : "insertadas";
    console.log(
      `${step.sqlTable}: ${rows.length} leídas, ${written} ${label}`,
    );
  }

  await pool.close();
  await prisma.$disconnect();
  console.log("\nMigración finalizada.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
