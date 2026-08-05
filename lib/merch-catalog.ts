export type MerchCatalogItem = {
  name: string;
  listPrice: number;
};

/** Recommended (list) prices for merch SKUs. */
export const MERCH_CATALOG: MerchCatalogItem[] = [
  { name: "Футболка домашняя", listPrice: 3500 },
  { name: "Футболка гостевая", listPrice: 3500 },
  { name: "Шарф клубный", listPrice: 1500 },
  { name: "Кепка с логотипом", listPrice: 2200 },
  { name: "Хоккейная клюшка mini", listPrice: 2800 },
  { name: "Детская форма", listPrice: 4000 },
  { name: "Термокружка", listPrice: 1200 },
  { name: "Свитшот с капюшоном", listPrice: 5500 },
  { name: "Джерси игровое", listPrice: 8500 },
  { name: "Шапка зимняя", listPrice: 1800 },
  { name: "Брелок клубный", listPrice: 450 },
  { name: "Значок клубный", listPrice: 350 },
  { name: "Носки хоккейные", listPrice: 900 },
  { name: "Рюкзак клубный", listPrice: 4200 },
  { name: "Плед с эмблемой", listPrice: 3200 },
  { name: "Кружка керамическая", listPrice: 800 },
  { name: "Варежки детские", listPrice: 1400 },
  { name: "Футболка поло", listPrice: 3800 },
  { name: "Шорты тренировочные", listPrice: 2600 },
];

const MERCH_LIST_PRICE_BY_NAME = new Map(
  MERCH_CATALOG.map((item) => [item.name, item.listPrice]),
);

export function getMerchProductName(description: string): string {
  return description.replace(/^Возврат:\s*/, "");
}

export function getMerchListPrice(productName: string): number | undefined {
  return MERCH_LIST_PRICE_BY_NAME.get(productName);
}

export function getMerchListAmount(tx: {
  description: string;
  quantity: number;
  listUnitPrice?: number;
}): number {
  const productName = getMerchProductName(tx.description);
  const unitPrice = tx.listUnitPrice ?? getMerchListPrice(productName);
  if (unitPrice == null) return 0;
  return unitPrice * tx.quantity;
}
