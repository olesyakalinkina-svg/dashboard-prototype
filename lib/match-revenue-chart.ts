export const MATCH_REVENUE_BAR_WIDTH = 48;
export const MATCH_REVENUE_CHART_MIN_WIDTH = 700;
/** Y-axis width (48) + chart left margin (0) + small buffer. */
export const MATCH_REVENUE_CHART_LEFT_GUTTER = 56;
export const MATCH_REVENUE_CHART_RIGHT_GUTTER = 8;
export const MATCH_REVENUE_MOBILE_CHART_HEIGHT = 250;
export const MATCH_REVENUE_DESKTOP_CHART_HEIGHT = 280;
export const MATCH_REVENUE_MOBILE_BREAKPOINT = 768;

export type ParsedMatchRevenueLabel = {
  opponent: string;
  date: string;
};

export function parseMatchRevenueLabel(match: string): ParsedMatchRevenueLabel {
  const matchResult = match.match(/^(.+)\s+(\d{2}-\d{2}-\d{2})$/);
  if (matchResult) {
    return { opponent: matchResult[1], date: matchResult[2] };
  }
  return { opponent: match, date: "" };
}

export function formatMatchRevenueDateShort(date: string): string {
  const [day, month] = date.split("-");
  if (!day || !month) return date;
  return `${day}.${month}`;
}

export function abbreviateMatchOpponent(opponent: string, maxLength = 5): string {
  if (opponent.length <= maxLength) return opponent;
  return `${opponent.slice(0, maxLength - 1)}…`;
}

export function formatMatchRevenueAxisLabel(
  match: string,
  isMobile: boolean,
): string {
  if (!isMobile) return match;

  const { opponent, date } = parseMatchRevenueLabel(match);
  if (date) return formatMatchRevenueDateShort(date);
  return abbreviateMatchOpponent(opponent);
}

export function getMatchRevenueChartWidth(
  count: number,
  options?: { containerWidth?: number },
): number {
  const plotWidth = Math.max(count, 1) * MATCH_REVENUE_BAR_WIDTH;
  const dataWidth =
    plotWidth +
    MATCH_REVENUE_CHART_LEFT_GUTTER +
    MATCH_REVENUE_CHART_RIGHT_GUTTER;

  if (options?.containerWidth != null && options.containerWidth > 0) {
    return Math.max(options.containerWidth, dataWidth);
  }

  return Math.max(dataWidth, MATCH_REVENUE_CHART_MIN_WIDTH);
}

export function shouldShowMatchRevenueScrollHint(
  chartWidth: number,
  viewportWidth: number,
): boolean {
  return viewportWidth > 0 && chartWidth > viewportWidth + 8;
}
