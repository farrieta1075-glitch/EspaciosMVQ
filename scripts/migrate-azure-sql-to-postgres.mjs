/**
 * Copia estructura (vía Prisma) y datos de Azure SQL → PostgreSQL.
 *
 * 1) En .env.local define POSTGRES_URL (destino) y credenciales Azure (origen).
 * 2) Crea tablas en Postgres: npm run db:push
 * 3) Copia datos: npm run db:migrate-from-azure
 *
 * Variables:
 *   POSTGRES_URL o DATABASE_URL — PostgreSQL destino (postgres://...)
 *   AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, AZURE_SQL_PASSWORD — origen
 *   o SOURCE_DATABASE_URL — cadena sqlserver completa
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import sql from "mssql";
import { PrismaClient } from "@prisma/client";

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
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const TABLES = [
  { sqlTable: "Users", prisma: "user" },
  { sqlTable: "Areas", prisma: "area" },
  { sqlTable: "Maps", prisma: "floorMap" },
  { sqlTable: "Resources", prisma: "resource" },
  { sqlTable: "Spaces", prisma: "space" },
  { sqlTable: "ResourceSpaces", prisma: "resourceSpace" },
  { sqlTable: "Reservations", prisma: "reservation" },
  { sqlTable: "ReservationResources", prisma: "reservationResource" },
  { sqlTable: "EventHistory", prisma: "eventHistory" },
  { sqlTable: "Notifications", prisma: "notification" },
  { sqlTable: "PushSubscriptions", prisma: "pushSubscription" },
  { sqlTable: "UserActivityLogs", prisma: "userActivityLog" },
];

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

async function fetchTable(pool, tableName) {
  const result = await pool
    .request()
    .query(`SELECT * FROM [${tableName.replace(/\]/g, "]]")}]`);
  return result.recordset.map(normalizeRow);
}

async function main() {
  const postgresUrl =
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!postgresUrl?.startsWith("postgres")) {
    throw new Error(
      "Define POSTGRES_URL (o DATABASE_URL) apuntando a PostgreSQL destino.",
    );
  }

  process.env.DATABASE_URL = postgresUrl;
  const prisma = new PrismaClient();
  const azureConfig = resolveAzureConfig();
  const pool = await sql.connect(azureConfig);

  console.log("Origen:", azureConfig.server, azureConfig.database);
  console.log("Destino: PostgreSQL\n");

  const truncate = process.argv.includes("--truncate");
  if (truncate) {
    console.log("Vaciando tablas destino (orden inverso)…");
    for (const { prisma: model } of [...TABLES].reverse()) {
      const delegate = prisma[model];
      if (delegate?.deleteMany) {
        await delegate.deleteMany();
      }
    }
  }

  for (const { sqlTable, prisma: model } of TABLES) {
    const rows = await fetchTable(pool, sqlTable);
    if (rows.length === 0) {
      console.log(`${sqlTable}: 0 filas (omitido)`);
      continue;
    }

    const delegate = prisma[model];
    if (!delegate?.createMany) {
      console.warn(`${sqlTable}: sin delegado Prisma «${model}»`);
      continue;
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
    console.log(`${sqlTable}: ${rows.length} leídas, ${inserted} insertadas`);
  }

  await pool.close();
  await prisma.$disconnect();
  console.log("\nMigración de datos completada.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
