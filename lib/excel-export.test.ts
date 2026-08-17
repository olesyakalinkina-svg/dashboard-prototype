import { describe, expect, it } from "vitest";
import {
  createExcelWorkbookBytes,
  sanitizeExcelFileName,
} from "@/lib/excel-export";

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

describe("excel export", () => {
  it("sanitizes file names", () => {
    expect(sanitizeExcelFileName("Продажи / матчи?")).toBe("Продажи матчи");
    expect(sanitizeExcelFileName("   ")).toBe("Данные");
  });

  it("builds a zip-based xlsx with a valid central directory", () => {
    const bytes = createExcelWorkbookBytes({
      fileName: "Продажи",
      headers: ["Мероприятие", "Выручка"],
      rows: [["СКА", 12500]],
    });

    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    const eocdOffset = bytes.length - 22;
    expect(readUint32(bytes, eocdOffset)).toBe(0x06054b50);
    const centralOffset = readUint32(bytes, eocdOffset + 16);
    expect(readUint32(bytes, centralOffset)).toBe(0x02014b50);

    const nameLength = readUint16(bytes, centralOffset + 28);
    const extraLength = readUint16(bytes, centralOffset + 30);
    const commentLength = readUint16(bytes, centralOffset + 32);
    expect(nameLength).toBeGreaterThan(0);
    expect(extraLength).toBe(0);
    expect(commentLength).toBe(0);

    const name = new TextDecoder().decode(
      bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength),
    );
    expect(name).toBe("[Content_Types].xml");

    const xml = new TextDecoder().decode(bytes);
    expect(xml).toContain("Мероприятие");
    expect(xml).toContain("СКА");
    expect(xml).toContain("<v>12500</v>");
  });
});
