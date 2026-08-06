export function formatBenchmarkYAxisTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    const billions = value / 1_000_000_000;
    return `${billions.toFixed(billions >= 10 ? 0 : 1).replace(".", ",")} млрд`;
  }
  if (abs >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions.toFixed(millions >= 10 ? 0 : 1).replace(".", ",")} млн`;
  }
  if (abs >= 1_000) {
    const thousands = value / 1_000;
    return `${Math.round(thousands).toLocaleString("ru-RU")} тыс`;
  }
  return String(Math.round(value));
}

export function formatDeviationAbsolute(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    return `${sign}${millions.toFixed(millions >= 10 ? 0 : 1).replace(".", ",")} млн ₽`;
  }
  if (abs >= 1_000) {
    const thousands = abs / 1_000;
    return `${sign}${Math.round(thousands).toLocaleString("ru-RU")} тыс ₽`;
  }
  return `${sign}${Math.round(abs).toLocaleString("ru-RU")} ₽`;
}

export function formatDeviationPercent(value: number | null): string {
  if (value === null) return "Нет базы для сравнения";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1).replace(".", ",")}%`;
}
