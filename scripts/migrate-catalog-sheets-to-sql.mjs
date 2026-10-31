/**
 * Migra Usuarios, Areas, Espacios, Mapas, Recursos y RecursoEspacio → Azure SQL.
 * NO migra Reservas, ReservaRecursos, EventoHistorico ni Notificaciones.
 *
 * Uso: node --env-file=.env.local scripts/migrate-catalog-sheets-to-sql.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { google } from "googleapis";
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

const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let privateKey = process.env.GOOGLE_PRIVATE_KEY ?? "";
if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");

if (!spreadsheetId || !email || !privateKey) {
  console.error("Faltan GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY");
  process.exit(1);
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("Falta DATABASE_URL para Azure SQL");
  process.exit(1);
}

const prisma = new PrismaClient();

async function readTab(tab) {
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:Z`,
  });
  const values = response.data.values ?? [];
  if (values.length <= 1) return [];
  const headers = values[0].map(String);
  return values.slice(1).map((row) =>
    headers.reduce((acc, header, index) => {
      acc[header] = String(row[index] ?? "");
      return acc;
    }, {}),
  );
}

function parseAreaScopeIds(raw) {
  const trimmed = raw?.trim();
  if (!trimmed) return "[]";
  if (trimmed.startsWith("[")) return trimmed;
  const ids = trimmed.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean);
  return JSON.stringify([...new Set(ids)]);
}

async function main() {
  console.log("Leyendo Google Sheets…");
  const [users, areas, spaces, maps, resources, links] = await Promise.all([
    readTab("Usuarios"),
    readTab("Areas"),
    readTab("Espacios"),
    readTab("Mapas"),
    readTab("Recursos"),
    readTab("RecursoEspacio"),
  ]);

  console.log(`Usuarios: ${users.length}, Areas: ${areas.length}, Espacios: ${spaces.length}, Mapas: ${maps.length}, Recursos: ${resources.length}, Links: ${links.length}`);

  for (const row of users) {
    if (!row.id?.trim()) continue;
    await prisma.user.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        email: row.email || null,
        username: row.username || null,
        passwordHash: row.passwordHash || null,
        role: (row.role || "GENERAL").toUpperCase(),
        areaId: row.areaId || null,
        active: String(row.active).toLowerCase() !== "false",
        receiveApprovalEmails: String(row.receiveApprovalEmails).toLowerCase() !== "false",
        areaScopeIds: parseAreaScopeIds(row.areaScopeIds),
      },
      update: {
        email: row.email || null,
        username: row.username || null,
        passwordHash: row.passwordHash || null,
        role: (row.role || "GENERAL").toUpperCase(),
        areaId: row.areaId || null,
        active: String(row.active).toLowerCase() !== "false",
        receiveApprovalEmails: String(row.receiveApprovalEmails).toLowerCase() !== "false",
        areaScopeIds: parseAreaScopeIds(row.areaScopeIds),
      },
    });
  }

  for (const row of areas) {
    if (!row.id?.trim()) continue;
    await prisma.area.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        name: row.name,
        code: row.code ?? "",
        parentId: row.parentId?.trim() || null,
        colorHex: row.colorHex ?? "",
        eventPresets: row.eventPresets ?? "[]",
      },
      update: {
        name: row.name,
        code: row.code ?? "",
        parentId: row.parentId?.trim() || null,
        colorHex: row.colorHex ?? "",
        eventPresets: row.eventPresets ?? "[]",
      },
    });
  }

  for (const row of maps) {
    if (!row.id?.trim()) continue;
    await prisma.floorMap.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        name: row.name,
        backgroundType: row.backgroundType || "blank",
        backgroundUrl: row.backgroundUrl ?? "",
        width: Number(row.width) || 0,
        height: Number(row.height) || 0,
        secondaryBackgroundType: row.secondaryBackgroundType ?? "",
        secondaryBackgroundUrl: row.secondaryBackgroundUrl ?? "",
        secondaryWidth: Number(row.secondaryWidth) || 0,
        secondaryHeight: Number(row.secondaryHeight) || 0,
        primaryFloor: row.primaryFloor === "2" ? "2" : "1",
        floor1Label: row.floor1Label || "Planta baja",
        floor2Label: row.floor2Label || "Piso 2",
      },
      update: {
        name: row.name,
        backgroundType: row.backgroundType || "blank",
        backgroundUrl: row.backgroundUrl ?? "",
        width: Number(row.width) || 0,
        height: Number(row.height) || 0,
        secondaryBackgroundType: row.secondaryBackgroundType ?? "",
        secondaryBackgroundUrl: row.secondaryBackgroundUrl ?? "",
        secondaryWidth: Number(row.secondaryWidth) || 0,
        secondaryHeight: Number(row.secondaryHeight) || 0,
        primaryFloor: row.primaryFloor === "2" ? "2" : "1",
        floor1Label: row.floor1Label || "Planta baja",
        floor2Label: row.floor2Label || "Piso 2",
      },
    });
  }

  for (const row of spaces) {
    if (!row.id?.trim()) continue;
    await prisma.space.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        name: row.name,
        floor: row.floor?.trim() || "1",
        capacity: Number(row.capacity) || 0,
        minCapacity: Number(row.minCapacity) || 1,
        geometryJson: row.geometryJson ?? "",
        mapId: row.mapId ?? "",
        active: String(row.active).toLowerCase() !== "false",
      },
      update: {
        name: row.name,
        floor: row.floor?.trim() || "1",
        capacity: Number(row.capacity) || 0,
        minCapacity: Number(row.minCapacity) || 1,
        geometryJson: row.geometryJson ?? "",
        mapId: row.mapId ?? "",
        active: String(row.active).toLowerCase() !== "false",
      },
    });
  }

  for (const row of resources) {
    if (!row.id?.trim()) continue;
    await prisma.resource.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        name: row.name,
        type: row.type || "OTRO",
        totalQty: Number(row.totalQty) || 0,
        imageUrl: row.imageUrl ?? "",
        scope: row.scope || "GLOBAL",
        active: String(row.active).toLowerCase() !== "false",
      },
      update: {
        name: row.name,
        type: row.type || "OTRO",
        totalQty: Number(row.totalQty) || 0,
        imageUrl: row.imageUrl ?? "",
        scope: row.scope || "GLOBAL",
        active: String(row.active).toLowerCase() !== "false",
      },
    });
  }

  await prisma.resourceSpace.deleteMany({});
  for (const row of links) {
    if (!row.resourceId?.trim() || !row.spaceId?.trim()) continue;
    await prisma.resourceSpace.upsert({
      where: {
        resourceId_spaceId: {
          resourceId: row.resourceId,
          spaceId: row.spaceId,
        },
      },
      create: {
        resourceId: row.resourceId,
        spaceId: row.spaceId,
      },
      update: {},
    });
  }

  console.log("Migración de catálogo completada.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
