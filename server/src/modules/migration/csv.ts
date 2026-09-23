// A small, dependency-free CSV parser (spec section 5) — handles quoted
// fields, embedded commas/newlines inside quotes, and escaped quotes
// ("" inside a quoted field). XLSX/Excel parsing is NOT implemented in
// this phase (no binary spreadsheet library is installed) — the staged
// pipeline below accepts CSV only; see the Phase 7 completion report's
// honest status for XLSX.

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(content: string): ParsedCsv {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const text = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0]!.map((h) => h.trim());
  const dataRows = nonEmpty.slice(1).map((r) => {
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (r[idx] ?? "").trim();
    });
    return record;
  });

  return { headers, rows: dataRows };
}
