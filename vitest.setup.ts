import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initMockDataSync } from "@/lib/mock/data-store";
import type { RawMockData } from "@/lib/mock/revive-dates";

const mockPath = join(process.cwd(), "lib/mock/data/hockey-mock.json");
const raw = JSON.parse(readFileSync(mockPath, "utf-8")) as RawMockData;
initMockDataSync(raw);

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
