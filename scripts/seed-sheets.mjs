/**
 * Inicializa pestañas y usuario admin en Google Sheets.
 * Uso: node scripts/seed-sheets.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { google } from "googleapis";

const SHEET_TABS = {
  USUARIOS: "Usuarios",
  AREAS: "Areas",
  ESPACIOS: "Espacios",
  MAPAS: "Mapas",
  RECURSOS: "Recursos",
  RECURSO_ESPACIO: "RecursoEspacio",
  RESERVAS: "Reservas",
  RESERVA_RECURSOS: "ReservaRecursos",
  EVENTO_HISTORICO: "EventoHistorico",
  NOTIFICACIONES: "Notificaciones",
};

const SHEET_HEADERS = {
  Usuarios: [
    "id",
    "email",
    "username",
    "passwordHash",
    "role",
    "areaId",
    "active",
  ],
  Areas: ["id", "name", "code"],
  Espacios: [
    "id",
    "name",
    "floor",
    "capacity",
    "geometryJson",
    "mapId",
    "active",
  ],
  Mapas: ["id", "name", "backgroundType", "backgroundUrl", "width", "height"],
  Recursos: [
    "id",
    "name",
    "type",
    "totalQty",
    "imageUrl",
    "scope",
    "active",
  ],
  RecursoEspacio: ["resourceId", "spaceId"],
  Reservas: [
    "id",
    "eventName",
    "spaceIds",
    "areaId",
    "userId",
    "startAt",
    "endAt",
    "recurrenceRule",
    "status",
    "eventDescription",
    "pendingAction",
    "pendingPayload",
    "approvalToken",
  ],
  ReservaRecursos: ["reservationId", "resourceId", "quantity"],
  EventoHistorico: ["eventName", "areaId", "count", "lastUsedAt"],
  Notificaciones: [
    "id",
    "userId",
    "areaId",
    "reservationId",
    "type",
    "message",
    "read",
    "createdAt",
  ],
};

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf8");
  const env = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex);
    let value = trimmed.slice(eqIndex + 1);

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value.replace(/\\n/g, "\n");
  }

  return env;
}

async function main() {
  const env = loadEnvLocal();
  const spreadsheetId = env.GOOGLE_SHEETS_ID;
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId || !email || !privateKey) {
    throw new Error("Faltan variables en .env.local");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets.properties(title,sheetId)",
  });

  console.log(`Spreadsheet: ${meta.data.properties?.title}`);
  const existingTabs = new Set(
    meta.data.sheets?.map((s) => s.properties?.title).filter(Boolean) ?? [],
  );

  const requests = [];

  for (const tab of Object.values(SHEET_TABS)) {
    if (!existingTabs.has(tab)) {
      requests.push({ addSheet: { properties: { title: tab } } });
      console.log(`+ Crear pestaña: ${tab}`);
    } else {
      console.log(`✓ Pestaña existente: ${tab}`);
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }

  for (const [tab, headers] of Object.entries(SHEET_HEADERS)) {
    const current = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A1:Z1`,
    });

    const firstRow = current.data.values?.[0] ?? [];
    const headersMatch =
      firstRow.length >= headers.length &&
      headers.every((header, index) => firstRow[index] === header);

    if (firstRow.length === 0 || !headersMatch) {
      const endCol = String.fromCharCode(65 + Math.max(headers.length - 1, 0));
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!A1:${endCol}1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
      console.log(
        firstRow.length === 0
          ? `+ Headers en ${tab}`
          : `↻ Headers actualizados en ${tab}`,
      );
    }
  }

  const users = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TABS.USUARIOS}!A2:G100`,
  });

  const rows = users.data.values ?? [];
  const hasAdmin = rows.some(
    (row) => row[0] === "admin-001" || row[2] === "admin",
  );

  if (!hasAdmin) {
    const passwordHash = await bcrypt.hash("Admin123!", 10);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_TABS.USUARIOS}!A:G`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            "admin-001",
            "admin@mvqro.local",
            "admin",
            passwordHash,
            "ADMIN",
            "",
            "true",
          ],
        ],
      },
    });
    console.log("+ Usuario admin creado (admin / Admin123!)");
  } else {
    console.log("✓ Usuario admin ya existe");
  }

  const areas = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TABS.AREAS}!A2:C100`,
  });

  if ((areas.data.values ?? []).length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_TABS.AREAS}!A:C`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          ["area-001", "General", "GEN"],
          ["area-vida-kids", "Vida Kids", "VK"],
        ],
      },
    });
    console.log("+ Áreas demo creadas (General, Vida Kids)");
  }

  console.log("\nSeed completado.");
}

main().catch((error) => {
  console.error("Error en seed:", error.message);
  process.exit(1);
});
