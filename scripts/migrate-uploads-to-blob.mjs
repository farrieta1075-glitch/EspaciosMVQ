/**
 * Sube archivos de public/uploads/* a Vercel Blob y actualiza URLs en Google Sheets.
 * Uso: node --env-file=.env.local scripts/migrate-uploads-to-blob.mjs
 *
 * Requiere: GOOGLE_* y BLOB_READ_WRITE_TOKEN en .env.local
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { put } from "@vercel/blob";
import { google } from "googleapis";

const MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    throw new Error("No existe .env.local");
  }
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

function parseIdFromFilename(filename) {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return null;
  return filename.slice(0, dot);
}

async function uploadFolder({ folder, sheets, spreadsheetId, tab, urlColumnIndex }) {
  const dir = join(process.cwd(), "public", "uploads", folder);
  if (!existsSync(dir)) {
    console.log(`(sin carpeta ${dir})`);
    return;
  }

  const files = readdirSync(dir).filter((name) => !name.startsWith("."));
  if (files.length === 0) {
    console.log(`(vacío: ${folder})`);
    return;
  }

  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:Z`,
  });
  const values = rowsRes.data.values ?? [];
  const dataRows = values.slice(1);

  for (const filename of files) {
    const id = parseIdFromFilename(filename);
    if (!id) continue;

    const rowIndex = dataRows.findIndex((row) => row[0]?.trim() === id);
    if (rowIndex === -1) {
      console.warn(`⚠ ${folder}/${filename}: id "${id}" no está en ${tab}`);
      continue;
    }

    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const buffer = await readFile(join(dir, filename));
    const access =
      (process.env.BLOB_ACCESS ?? "private").trim().toLowerCase() === "public"
        ? "public"
        : "private";

    const blob = await put(`${folder}/${filename}`, buffer, {
      access,
      contentType: MIME_BY_EXT[ext] ?? "application/octet-stream",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    const storedUrl = access === "private" ? `blob:${blob.pathname}` : blob.url;

    const sheetRow = rowIndex + 2;
    const col = String.fromCharCode(65 + urlColumnIndex);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!${col}${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[storedUrl]] },
    });

    console.log(`✓ ${folder}/${filename} → ${storedUrl}`);
  }
}

async function main() {
  const env = loadEnvLocal();
  for (const key of [
    "GOOGLE_SHEETS_ID",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
    "BLOB_READ_WRITE_TOKEN",
  ]) {
    if (!env[key]?.trim()) {
      throw new Error(`Falta ${key} en .env.local`);
    }
  }

  process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN.trim();
  process.env.BLOB_ACCESS = (env.BLOB_ACCESS ?? "private").trim();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
      private_key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = env.GOOGLE_SHEETS_ID.trim();

  console.log("Subiendo mapas (backgroundUrl)…");
  await uploadFolder({
    folder: "maps",
    sheets,
    spreadsheetId,
    tab: "Mapas",
    urlColumnIndex: 3,
  });

  console.log("Subiendo recursos (imageUrl)…");
  await uploadFolder({
    folder: "resources",
    sheets,
    spreadsheetId,
    tab: "Recursos",
    urlColumnIndex: 4,
  });

  console.log("Listo. Redeploy en Vercel si hace falta y recarga la app.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
