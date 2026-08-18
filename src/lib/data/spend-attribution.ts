/**
 * Per-team spend attribution and forecasting.
 *
 * Budgets are owned by teams, but spend arrives per seat (an employee, an
 * agent's service account). Attribution rolls seat-level spend up to the team
 * that owns the budget, projects it to the end of the period at the current
 * burn rate, and reports the day the cap is expected to break — so an owner
 * sees a breach coming instead of discovering it after the fact.
 *
 * All pure functions: unit-testable and shared by the console and the server.
 */

export interface SeatSpend {
  id: string;
  name: string;
  team: string;
  cost: number;
}

export interface TeamBudgetLine {
  team: string;
  cap: number;
  /** Set when spend is tracked outside the seat roster; otherwise derived. */
  spent?: number;
  active?: boolean;
}

export interface AttributionRow {
  team: string;
  cap: number;
  /** Spend attributed from the seat roster (falls back to the budget's own). */
  attributed: number;
  seats: number;
  /** 0..1+ — attributed / cap. Infinity-safe: cap 0 reports 1. */
  utilization: number;
  /** Share of total attributed spend across all rows, 0..1. */
  share: number;
  /** USD per day at the current pace. */
  burnPerDay: number;
  /** Projected spend at period end. */
  forecast: number;
  /** Day of the period the cap is projected to break, or null if it holds. */
  breachDay: number | null;
  status: "healthy" | "at-risk" | "breached";
}

export interface Period {
  /** 1-based day elapsed in the period. */
  dayOfPeriod: number;
  daysInPeriod: number;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function attributeSeats(seats: SeatSpend[]): Map<string, { cost: number; seats: number }> {
  const out = new Map<string, { cost: number; seats: number }>();
  for (const s of seats) {
    const key = (s.team ?? "").trim() || "Unassigned";
    const prev = out.get(key) ?? { cost: 0, seats: 0 };
    out.set(key, { cost: prev.cost + Math.max(0, s.cost || 0), seats: prev.seats + 1 });
  }
  return out;
}

export function statusFor(utilization: number): AttributionRow["status"] {
  if (utilization >= 1) return "breached";
  if (utilization >= 0.85) return "at-risk";
  return "healthy";
}

/** First day of the period on which projected cumulative spend exceeds the cap. */
export function projectBreachDay(
  spent: number,
  cap: number,
  period: Period,
): number | null {
  const day = Math.max(1, Math.floor(period.dayOfPeriod));
  const total = Math.max(day, Math.floor(period.daysInPeriod));
  if (cap <= 0) return day;
  if (spent >= cap) return day;
  const perDay = spent / day;
  if (perDay <= 0) return null;
  const breach = Math.ceil(cap / perDay);
  return breach <= total ? breach : null;
}

export function attributeSpend(
  budgets: TeamBudgetLine[],
  seats: SeatSpend[],
  period: Period,
): AttributionRow[] {
  const day = Math.max(1, Math.floor(period.dayOfPeriod));
  const days = Math.max(day, Math.floor(period.daysInPeriod));
  const bySeat = attributeSeats(seats);
  const lines = budgets.filter((b) => b.active !== false);

  const base = lines.map((b) => {
    const roster = bySeat.get(b.team);
    const attributed = round2(roster?.cost ?? b.spent ?? 0);
    return { line: b, attributed, seats: roster?.seats ?? 0 };
  });
  const total = base.reduce((s, r) => s + r.attributed, 0);

  return base.map(({ line, attributed, seats: seatCount }) => {
    const cap = Math.max(0, line.cap);
    const utilization = cap === 0 ? 1 : attributed / cap;
    const burnPerDay = attributed / day;
    return {
      team: line.team,
      cap,
      attributed,
      seats: seatCount,
      utilization,
      share: total === 0 ? 0 : attributed / total,
      burnPerDay: round2(burnPerDay),
      forecast: round2(burnPerDay * days),
      breachDay: projectBreachDay(attributed, cap, { dayOfPeriod: day, daysInPeriod: days }),
      status: statusFor(utilization),
    };
  });
}

export interface AttributionTotals {
  cap: number;
  attributed: number;
  forecast: number;
  /** Attributed spend with no matching team budget — nobody is accountable. */
  unallocated: number;
  breaching: number;
  atRisk: number;
}

export function summarizeAttribution(
  rows: AttributionRow[],
  seats: SeatSpend[],
): AttributionTotals {
  const owned = new Set(rows.map((r) => r.team));
  const unallocated = seats
    .filter((s) => !owned.has((s.team ?? "").trim() || "Unassigned"))
    .reduce((sum, s) => sum + Math.max(0, s.cost || 0), 0);
  return {
    cap: round2(rows.reduce((s, r) => s + r.cap, 0)),
    attributed: round2(rows.reduce((s, r) => s + r.attributed, 0)),
    forecast: round2(rows.reduce((s, r) => s + r.forecast, 0)),
    unallocated: round2(unallocated),
    breaching: rows.filter((r) => r.status === "breached").length,
    atRisk: rows.filter((r) => r.status === "at-risk").length,
  };
}

/** Chargeback export rows — the finance-facing view of attribution. */
export function chargebackCsv(rows: AttributionRow[]): string {
  const header =
    "team,seats,cap_usd,attributed_usd,utilization_pct,burn_per_day_usd,forecast_usd,breach_day,status\n";
  const body = rows
    .map((r) =>
      [
        `"${r.team.replace(/"/g, '""')}"`,
        r.seats,
        r.cap.toFixed(2),
        r.attributed.toFixed(2),
        (r.utilization * 100).toFixed(1),
        r.burnPerDay.toFixed(2),
        r.forecast.toFixed(2),
        r.breachDay ?? "",
        r.status,
      ].join(","),
    )
    .join("\n");
  return header + body;
}
