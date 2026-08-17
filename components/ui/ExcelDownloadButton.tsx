"use client";

import type { Table } from "@tanstack/react-table";
import { FileSpreadsheet } from "lucide-react";
import { downloadExcelFromTable, downloadExcelWorkbook, type ExcelValue } from "@/lib/excel-export";

const BUTTON_CLASS =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8";

export function ExcelDownloadButton({
  disabled,
  onDownload,
}: {
  disabled?: boolean;
  onDownload: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Скачать Excel"
      title="Скачать Excel"
      disabled={disabled}
      onClick={onDownload}
      className={BUTTON_CLASS}
    >
      <FileSpreadsheet className="h-4 w-4" />
    </button>
  );
}

export function TableExcelButton<T>({
  table,
  fileName,
  sheetName,
}: {
  table: Table<T>;
  fileName: string;
  sheetName?: string;
}) {
  return (
    <ExcelDownloadButton
      disabled={table.getFilteredRowModel().rows.length === 0}
      onDownload={() => downloadExcelFromTable(table, fileName, sheetName)}
    />
  );
}

export function RowsExcelButton({
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
  return (
    <ExcelDownloadButton
      disabled={rows.length === 0}
      onDownload={() =>
        downloadExcelWorkbook({ fileName, sheetName, headers, rows })
      }
    />
  );
}
