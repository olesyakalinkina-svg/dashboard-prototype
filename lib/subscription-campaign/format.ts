import { format, parse } from "date-fns";
import { ru } from "date-fns/locale";
import { formatCurrency, formatNumber } from "@/lib/format";
import { parseCalendarDate } from "@/lib/subscription-campaign/dates";

export function formatCampaignDayTitle(campaignDay: number): string {
  return `${campaignDay}-й день кампании`;
}

export function formatCampaignDate(value: string | Date | null): string {
  if (value == null) return "—";
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parse(value, "yyyy-MM-dd", new Date())
      : parseCalendarDate(value);
  return format(date, "dd.MM.yyyy", { locale: ru });
}

function formatCompactMagnitude(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) {
    return String(Math.round(rounded));
  }
  return rounded.toFixed(1).replace(".", ",");
}

/** Y-axis money: `5 млн ₽`, `42,8 млн ₽`. */
export function formatCampaignMoneyAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${formatCompactMagnitude(value / 1_000_000_000)} млрд ₽`;
  }
  if (abs >= 1_000_000) {
    return `${formatCompactMagnitude(value / 1_000_000)} млн ₽`;
  }
  if (abs >= 10_000) {
    return `${Math.round(value / 1000).toLocaleString("ru-RU")} тыс ₽`;
  }
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export function formatCampaignCountAxis(value: number): string {
  return formatNumber(Math.round(value));
}

export function formatPercentageGap(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1).replace(".", ",")}%`;
}

export function formatSignedNumber(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(Math.round(value))}`;
}

export function formatGapCell(
  absolute: number | null,
  percentage: number | null,
): { text: string; tone: "positive" | "negative" | "neutral" } {
  if (absolute == null) {
    return { text: "—", tone: "neutral" };
  }
  if (absolute === 0) {
    return { text: "0", tone: "neutral" };
  }

  const percentText = formatPercentageGap(percentage);
  const absText = formatSignedNumber(absolute);
  if (percentText == null) {
    return {
      text: `${absText} (Нет базы для сравнения)`,
      tone: absolute > 0 ? "positive" : "negative",
    };
  }

  return {
    text: `${absText} (${percentText})`,
    tone: absolute > 0 ? "positive" : "negative",
  };
}

export function formatFullRevenue(value: number | null): string {
  if (value == null) return "—";
  return formatCurrency(value);
}

export function formatFullCount(value: number | null): string {
  if (value == null) return "—";
  return formatNumber(value);
}

export const ZERO_BASE_LABEL = "Нет базы для сравнения";
