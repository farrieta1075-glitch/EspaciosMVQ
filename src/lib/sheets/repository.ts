import type { SheetTab } from "./tabs";
import { SHEET_HEADERS } from "./tabs";
import { getGoogleSheetsClient, getSpreadsheetId } from "./client";

export type SheetRow = Record<string, string>;

function columnIndexToLetter(index: number): string {
  let letter = "";
  let current = index;

  while (current >= 0) {
    letter = String.fromCharCode((current % 26) + 65) + letter;
    current = Math.floor(current / 26) - 1;
  }

  return letter;
}

function rowsToObjects(headers: string[], rows: string[][]): SheetRow[] {
  return rows.map((row) =>
    headers.reduce<SheetRow>((acc, header, index) => {
      acc[header] = row[index] ?? "";
      return acc;
    }, {}),
  );
}

export async function getSheetRows(tab: SheetTab): Promise<{
  headers: string[];
  rows: SheetRow[];
}> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:Z`,
  });

  const values = response.data.values ?? [];
  if (values.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headerRow, ...dataRows] = values;
  const headers = headerRow.map(String);
  const rows = rowsToObjects(headers, dataRows.map((row) => row.map(String)));

  return { headers, rows };
}

/** Mapea filas por posición de columna (A, B, C…) según SHEET_HEADERS, no por la fila 1 del Sheet. */
export async function getSheetRowsCanonical(tab: SheetTab): Promise<{
  headers: string[];
  rows: SheetRow[];
}> {
  const expectedHeaders = SHEET_HEADERS[tab];
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const endColumn = columnIndexToLetter(Math.max(expectedHeaders.length - 1, 0));

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:${endColumn}`,
  });

  const values = response.data.values ?? [];
  if (values.length <= 1) {
    return { headers: [...expectedHeaders], rows: [] };
  }

  const dataRows = values.slice(1);
  const rows = dataRows.map((row) =>
    expectedHeaders.reduce<SheetRow>((acc, header, index) => {
      acc[header] = String(row[index] ?? "");
      return acc;
    }, {}),
  );

  return { headers: [...expectedHeaders], rows };
}

export async function appendSheetRow(
  tab: SheetTab,
  rowValues: string[],
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const expectedLen = SHEET_HEADERS[tab]?.length ?? rowValues.length;
  const normalized = [...rowValues];
  while (normalized.length < expectedLen) {
    normalized.push("");
  }

  const endColumn = columnIndexToLetter(Math.max(normalized.length - 1, 0));

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A:${endColumn}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [normalized],
    },
  });
}

export async function updateSheetRowByIndex(
  tab: SheetTab,
  rowIndex: number,
  rowValues: string[],
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const endColumn = columnIndexToLetter(Math.max(rowValues.length - 1, 0));

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A${rowIndex}:${endColumn}${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [rowValues],
    },
  });
}

export async function deleteSheetRowByIndex(
  tab: SheetTab,
  rowIndex: number,
  sheetId: number,
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
}

export async function getSheetMeta(tab: SheetTab) {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  const sheet = response.data.sheets?.find(
    (item) => item.properties?.title === tab,
  );

  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
    throw new Error(`No se encontró la pestaña "${tab}" en el spreadsheet.`);
  }

  return {
    sheetId: sheet.properties.sheetId,
    title: sheet.properties.title ?? tab,
  };
}

export async function findRowIndexById(
  tab: SheetTab,
  id: string,
  idColumn = "id",
): Promise<number | null> {
  const { rows } = await getSheetRowsCanonical(tab);
  const rowIndex = rows.findIndex((row) => row[idColumn]?.trim() === id.trim());
  if (rowIndex === -1) return null;

  return rowIndex + 2;
}

export async function updateSheetRowById(
  tab: SheetTab,
  id: string,
  rowValues: string[],
): Promise<boolean> {
  const rowIndex = await findRowIndexById(tab, id);
  if (!rowIndex) return false;
  await updateSheetRowByIndex(tab, rowIndex, rowValues);
  return true;
}

export async function testSheetsConnection(): Promise<{
  ok: boolean;
  title?: string;
  tabs?: string[];
  error?: string;
}> {
  try {
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets.properties.title",
    });

    return {
      ok: true,
      title: response.data.properties?.title ?? undefined,
      tabs:
        response.data.sheets
          ?.map((sheet) => sheet.properties?.title)
          .filter(Boolean) as string[] | undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
