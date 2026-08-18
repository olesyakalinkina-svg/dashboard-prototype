const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("ru-RU");

const percentFormatter = new Intl.NumberFormat("ru-RU", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** Compact currency for narrow mobile KPI cards (e.g. 1,2 млн ₽). */
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    const billions = value / 1_000_000_000;
    return `${billions.toFixed(billions >= 10 ? 0 : 1).replace(".", ",")} млрд ₽`;
  }
  if (abs >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions.toFixed(millions >= 10 ? 0 : 1).replace(".", ",")} млн ₽`;
  }
  if (abs >= 10_000) {
    const thousands = value / 1_000;
    return `${Math.round(thousands).toLocaleString("ru-RU")} тыс. ₽`;
  }
  return formatCurrency(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatPercent(value: number): string {
  return percentFormatter.format(value / 100);
}

export function formatPercentSigned(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const SHORT_MONTHS_RU = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
] as const;

export function formatShortMonthYear(date: Date): string {
  const month = SHORT_MONTHS_RU[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${month} ${year}`;
}

export const STREAM_LABELS: Record<string, string> = {
  tickets: "Билеты",
  merch: "Мерч",
  all: "Все направления",
};

export const CHANNEL_LABELS: Record<string, string> = {
  online: "Онлайн",
  arena: "Арена",
  kiosk: "Киоск",
};
