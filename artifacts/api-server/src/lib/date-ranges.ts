export type ReportPeriod = "day" | "week" | "month";

export function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseReferenceDate(value: unknown): Date {
  if (typeof value !== "string" || value.trim() === "") return new Date();
  const date = isDateOnly(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function parseDateBoundary(value: string, boundary: "start" | "end"): Date | null {
  const date = isDateOnly(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  if (boundary === "end" && isDateOnly(value)) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date;
}

export function getReportRange(period: ReportPeriod, referenceDate: Date) {
  const start = new Date(referenceDate);
  start.setUTCHours(0, 0, 0, 0);

  if (period === "month") {
    start.setUTCDate(1);
  }

  if (period === "week") {
    const day = start.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setUTCDate(start.getUTCDate() + diffToMonday);
  }

  const endExclusive = new Date(start);
  if (period === "day") endExclusive.setUTCDate(start.getUTCDate() + 1);
  if (period === "week") endExclusive.setUTCDate(start.getUTCDate() + 7);
  if (period === "month") endExclusive.setUTCMonth(start.getUTCMonth() + 1);

  const endInclusive = new Date(endExclusive.getTime() - 1);
  return { start, endExclusive, endInclusive };
}
