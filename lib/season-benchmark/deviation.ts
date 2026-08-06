export function calculateDeviation(
  currentRevenue: number,
  benchmarkRevenue: number,
): {
  absoluteDeviation: number;
  percentageDeviation: number | null;
} {
  const absoluteDeviation = currentRevenue - benchmarkRevenue;

  if (benchmarkRevenue === 0) {
    return { absoluteDeviation, percentageDeviation: null };
  }

  return {
    absoluteDeviation,
    percentageDeviation: (absoluteDeviation / benchmarkRevenue) * 100,
  };
}
