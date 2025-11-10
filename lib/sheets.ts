import { google } from "googleapis";

/** 0-based column index -> A1 column string */
function toA1Column(idx: number): string {
  let n = idx + 1; // 1-based
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const DEFAULT_SHEET_NAME = "Profiles";

/** JSON(전체) 또는 PEM만 들어와도 모두 지원 */
let svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
let privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
try {
  const parsed = JSON.parse(privateKeyRaw);
  svcEmail = parsed.client_email;
  privateKeyRaw = parsed.private_key || privateKeyRaw;
} catch { /* raw PEM */ }
const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

const auth = new google.auth.JWT(
  svcEmail,
  undefined,
  privateKey,
  ["https://www.googleapis.com/auth/spreadsheets"]
);
const sheets = google.sheets({ version: "v4", auth });

export async function upsertProfileRow({
  id, name, company, role, intro, tags, updated_at, sheetName = DEFAULT_SHEET_NAME
}: any) {
  const read = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = read.data.values || [];
  const header = rows[0] || [];
  const idIdx = header.indexOf("id");

  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][idIdx] || "") === id) { rowIndex = i; break; }
  }

  const introIdx = header.indexOf("intro");
  const tagsStr = Array.isArray(tags) ? tags.join(",") : (tags || "");
  const payload = [
    id, name ?? "", company ?? "", role ?? "",
    intro ?? "", tagsStr, updated_at ?? new Date().toISOString()
  ];

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: "RAW",
      requestBody: { values: [payload] },
    });
  } else {
    const target = `${sheetName}!A${rowIndex + 1}:G${rowIndex + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: target,
      valueInputOption: "RAW",
      requestBody: { values: [payload] },
    });
  }
}

export async function upsertProfileIntroById(id: string, intro: string, sheetName = DEFAULT_SHEET_NAME) {
  const read = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const rows = read.data.values || [];
  if (rows.length === 0) throw new Error("Sheet is empty or header missing");

  const header = rows[0];
  const idIdx = header.indexOf("id");
  const introIdx = header.indexOf("intro");
  if (idIdx === -1 || introIdx === -1) {
    throw new Error("Header must include 'id' and 'intro'");
  }

  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][idIdx] || "") === id) { rowIndex = i; break; }
  }

  if (rowIndex === -1) {
    const newRow: string[] = Array(Math.max(header.length, introIdx + 1)).fill("");
    newRow[idIdx] = id;
    newRow[introIdx] = intro;
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: "RAW",
      requestBody: { values: [newRow] },
    });
  } else {
    const colA1 = toA1Column(introIdx);
    const a1Range = `${sheetName}!${colA1}${rowIndex + 1}:${colA1}${rowIndex + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: a1Range,
      valueInputOption: "RAW",
      requestBody: { values: [[intro]] },
    });
  }
}