import type { Table } from "@tanstack/react-table";
import { formatDate } from "@/lib/format";

export type ExcelValue = string | number | Date | boolean | null | undefined;

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    table[index] = crc >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function buildZip(files: { path: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;
    const utf8Flag = 0x0800;

    const local = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    writeUint32(local, 0, 0x04034b50);
    writeUint16(local, 4, 20);
    writeUint16(local, 6, utf8Flag);
    writeUint16(local, 8, 0);
    writeUint32(local, 14, crc);
    writeUint32(local, 18, size);
    writeUint32(local, 22, size);
    writeUint16(local, 26, nameBytes.length);
    writeUint16(local, 28, 0);
    local.set(nameBytes, 30);
    local.set(dataBytes, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    writeUint32(central, 0, 0x02014b50);
    writeUint16(central, 4, 20);
    writeUint16(central, 6, 20);
    writeUint16(central, 8, utf8Flag);
    writeUint16(central, 10, 0);
    writeUint32(central, 16, crc);
    writeUint32(central, 20, size);
    writeUint32(central, 24, size);
    writeUint16(central, 28, nameBytes.length);
    writeUint16(central, 30, 0);
    writeUint16(central, 32, 0);
    writeUint32(central, 42, offset);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const eocd = new Uint8Array(22);
  writeUint32(eocd, 0, 0x06054b50);
  writeUint16(eocd, 8, files.length);
  writeUint16(eocd, 10, files.length);
  writeUint32(eocd, 12, centralDirectory.length);
  writeUint32(eocd, 16, offset);

  return concatBytes([...localParts, centralDirectory, eocd]);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function colLetter(index: number): string {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, " ").trim();
  return (cleaned || "Данные").slice(0, 31);
}

export function sanitizeExcelFileName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || "Данные";
}

function toExcelValue(value: unknown): ExcelValue {
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function formatNumericCell(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10000) / 10000);
}

function cellXml(rowIndex: number, colIndex: number, value: ExcelValue): string {
  const ref = `${colLetter(colIndex)}${rowIndex}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${formatNumericCell(value)}</v></c>`;
  }
  const raw = value == null ? "" : String(value);
  const text = escapeXml(raw);
  const space = raw !== raw.trim() ? ' xml:space="preserve"' : "";
  return `<c r="${ref}" t="inlineStr"><is><t${space}>${text}</t></is></c>`;
}

function padRow(row: ExcelValue[], columnCount: number): ExcelValue[] {
  if (row.length >= columnCount) return row.slice(0, columnCount);
  return [...row, ...Array.from({ length: columnCount - row.length }, () => "")];
}

function buildSheetXml(headers: string[], rows: ExcelValue[][]): string {
  const columnCount = Math.max(headers.length, 1);
  const paddedRows = rows.map((row) => padRow(row, columnCount));
  const lastCol = colLetter(columnCount - 1);
  const lastRow = paddedRows.length + 1;
  const sheetData = [
    `<row r="1">${headers
      .map((header, index) => cellXml(1, index, header))
      .join("")}</row>`,
    ...paddedRows.map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 2}">${row
          .map((value, colIndex) => cellXml(rowIndex + 2, colIndex, value))
          .join("")}</row>`,
    ),
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCol}${lastRow}"/><sheetData>${sheetData}</sheetData></worksheet>`;
}

function buildWorkbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sanitizeSheetName(sheetName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

export function getExcelDataFromTable<T>(table: Table<T>): {
  headers: string[];
  rows: ExcelValue[][];
} {
  const columns = table.getVisibleLeafColumns();
  const headers = columns.map((column) => {
    const header = column.columnDef.header;
    return typeof header === "string" ? header : column.id;
  });
  const rows = table.getSortedRowModel().rows.map((row) =>
    columns.map((column) => toExcelValue(row.getValue(column.id))),
  );
  return { headers, rows };
}

export function createExcelWorkbookBytes({
  fileName,
  sheetName,
  headers,
  rows,
}: {
  fileName: string;
  sheetName?: string;
  headers: string[];
  rows: ExcelValue[][];
}): Uint8Array {
  const title = sanitizeExcelFileName(fileName);
  return buildZip([
    { path: "[Content_Types].xml", content: CONTENT_TYPES_XML },
    { path: "_rels/.rels", content: ROOT_RELS_XML },
    { path: "xl/workbook.xml", content: buildWorkbookXml(sheetName ?? title) },
    { path: "xl/_rels/workbook.xml.rels", content: WORKBOOK_RELS_XML },
    {
      path: "xl/worksheets/sheet1.xml",
      content: buildSheetXml(headers, rows),
    },
  ]);
}

export function downloadExcelWorkbook({
  fileName,
  sheetName,
  headers,
  rows,
}: {
  fileName: string;
  sheetName?: string;
  headers: string[];
  rows: ExcelValue[][];
}) {
  const title = sanitizeExcelFileName(fileName);
  const workbook = createExcelWorkbookBytes({
    fileName,
    sheetName,
    headers,
    rows,
  });
  const buffer = new ArrayBuffer(workbook.byteLength);
  new Uint8Array(buffer).set(workbook);

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadExcelFromTable<T>(
  table: Table<T>,
  fileName: string,
  sheetName?: string,
) {
  const { headers, rows } = getExcelDataFromTable(table);
  downloadExcelWorkbook({ fileName, sheetName, headers, rows });
}
