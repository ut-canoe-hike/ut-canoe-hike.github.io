const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SheetRow {
  [key: string]: string;
}

// Get all rows from a sheet as objects (header row defines keys)
export async function getRows(
  token: string,
  sheetId: string,
  sheetName: string
): Promise<SheetRow[]> {
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const url = `${SHEETS_API}/${sheetId}/values/${range}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 404) return []; // Sheet doesn't exist yet
    const text = await response.text();
    throw new Error(`Sheets API error: ${text}`);
  }

  const data = await response.json() as { values?: string[][] };
  const values = data.values ?? [];
  if (values.length < 2) return [];

  const headers = values[0];
  const rows: SheetRow[] = [];

  for (let i = 1; i < values.length; i++) {
    const row: SheetRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[i][j] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

// Append a row to a sheet
export async function appendRow(
  token: string,
  sheetId: string,
  sheetName: string,
  headers: string[],
  values: Record<string, string | number | Date>
): Promise<void> {
  // First, ensure headers exist
  await ensureHeaders(token, sheetId, sheetName, headers);

  // Build row array in header order
  const row = headers.map(h => {
    const v = values[h];
    if (v instanceof Date) return v.toISOString();
    return v?.toString() ?? '';
  });

  const range = encodeURIComponent(`${sheetName}!A:A`);
  const url = `${SHEETS_API}/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [row] }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to append row: ${text}`);
  }
}

// Update a specific cell
export async function updateCell(
  token: string,
  sheetId: string,
  sheetName: string,
  row: number,
  col: number,
  value: string
): Promise<void> {
  const colLetter = String.fromCharCode(64 + col); // 1=A, 2=B, etc.
  const range = encodeURIComponent(`${sheetName}!${colLetter}${row}`);
  const url = `${SHEETS_API}/${sheetId}/values/${range}?valueInputOption=RAW`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [[value]] }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update cell: ${text}`);
  }
}

// Delete a row
export async function deleteRow(
  token: string,
  sheetId: string,
  sheetName: string,
  rowIndex: number // 1-based
): Promise<void> {
  // First get the sheet's gid (numeric ID)
  const metaUrl = `${SHEETS_API}/${sheetId}?fields=sheets.properties`;
  const metaResponse = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!metaResponse.ok) {
    throw new Error('Failed to get sheet metadata');
  }

  const meta = await metaResponse.json() as {
    sheets: { properties: { title: string; sheetId: number } }[];
  };

  const sheet = meta.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

  const gid = sheet.properties.sheetId;

  // Delete the row using batchUpdate
  const url = `${SHEETS_API}/${sheetId}:batchUpdate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: gid,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-based
              endIndex: rowIndex,
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete row: ${text}`);
  }
}

// Ensure a sheet exists with the correct headers
async function ensureHeaders(
  token: string,
  sheetId: string,
  sheetName: string,
  headers: string[]
): Promise<void> {
  const range = encodeURIComponent(`${sheetName}!1:1`);
  const url = `${SHEETS_API}/${sheetId}/values/${range}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 400) {
    // Sheet might not exist, create it
    await createSheet(token, sheetId, sheetName);
  }

  // Check existing headers
  let existingHeaders: string[] = [];
  if (response.ok) {
    const data = await response.json() as { values?: string[][] };
    existingHeaders = data.values?.[0] ?? [];
  }

  // If headers match, we're done
  if (headers.every((h, i) => existingHeaders[i] === h)) return;

  // Set headers
  const setUrl = `${SHEETS_API}/${sheetId}/values/${range}?valueInputOption=RAW`;
  const setResponse = await fetch(setUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [headers] }),
  });

  if (!setResponse.ok) {
    const text = await setResponse.text();
    throw new Error(`Failed to set headers: ${text}`);
  }
}

// Create a new sheet tab
async function createSheet(
  token: string,
  sheetId: string,
  sheetName: string
): Promise<void> {
  const url = `${SHEETS_API}/${sheetId}:batchUpdate`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: { title: sheetName },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create sheet "${sheetName}": ${text}`);
  }
}

// Find a row by a column value, return row index (1-based, including header)
export async function findRowByColumn(
  token: string,
  sheetId: string,
  sheetName: string,
  columnName: string,
  value: string
): Promise<{ rowIndex: number; row: SheetRow } | null> {
  const rows = await getRows(token, sheetId, sheetName);

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][columnName] === value) {
      return { rowIndex: i + 2, row: rows[i] }; // +2 because: 0-based array + header row
    }
  }

  return null;
}

// Get column index by name (1-based)
export async function getColumnIndex(
  token: string,
  sheetId: string,
  sheetName: string,
  columnName: string
): Promise<number> {
  const range = encodeURIComponent(`${sheetName}!1:1`);
  const url = `${SHEETS_API}/${sheetId}/values/${range}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return -1;

  const data = await response.json() as { values?: string[][] };
  const headers = data.values?.[0] ?? [];

  const index = headers.indexOf(columnName);
  return index === -1 ? -1 : index + 1;
}
