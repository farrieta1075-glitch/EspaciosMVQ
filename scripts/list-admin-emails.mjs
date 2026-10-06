import { google } from "googleapis";

const HEADERS = [
  "id",
  "email",
  "username",
  "passwordHash",
  "role",
  "areaId",
  "active",
];

function rowToObject(row) {
  return HEADERS.reduce((acc, key, index) => {
    acc[key] = String(row[index] ?? "");
    return acc;
  }, {});
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY,
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

const response = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: "Usuarios!A:G",
});

const values = response.data.values ?? [];
const rows = values.slice(1).map(rowToObject);

console.log("Administradores activos y correo (columna B = email):\n");

for (const row of rows) {
  if (row.role !== "ADMIN") continue;
  console.log(
    `- id=${row.id} | email=${row.email || "(vacío)"} | username=${row.username || "—"} | active=${row.active}`,
  );
}
