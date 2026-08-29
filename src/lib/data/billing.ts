/**
 * Billing meters & plan enforcement — pure logic.
 *
 * Turns a subscription plan and a set of usage meters into:
 * - Human-readable entitlement summaries
 * - Limit checks before expensive operations (runs, token spend)
 * - Upgrade prompts when usage approaches a cap
 *
 * All pure functions: unit-testable, no side effects.
 */

export type MeterName = "seats" | "runs" | "tokens" | "cost_usd";

export interface PlanLimits {
  seats: number;
  runs_per_month: number;
  tokens_per_month: number;
  cost_usd_per_month: number;
}

export interface BillingPlan {
  id: string;
  user_id: string;
  name: string;
  price_usd: number;
  billing_interval: "monthly" | "annual";
  limits: PlanLimits;
  features: string[];
  created_at: string;
  updated_at: string;
}

export interface UsageMeter {
  id: string;
  user_id: string;
  plan_id: string | null;
  name: MeterName;
  current_value: number;
  limit_value: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

export interface EntitlementCheck {
  ok: boolean;
  meter: MeterName;
  current: number;
  limit: number;
  remaining: number;
  pct: number;
  reason: string;
}

export interface EnforcementResult {
  allowed: boolean;
  checks: EntitlementCheck[];
  blocking: EntitlementCheck[];
  upgradeRequired: boolean;
}

const METER_LABELS: Record<MeterName, string> = {
  seats: "Seats",
  runs: "Runs / month",
  tokens: "Tokens / month",
  cost_usd: "Spend / month",
};

const LIMIT_TO_METER: Record<keyof PlanLimits, MeterName> = {
  seats: "seats",
  runs_per_month: "runs",
  tokens_per_month: "tokens",
  cost_usd_per_month: "cost_usd",
};

export function parseLimits(raw: unknown): PlanLimits {
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    seats: Number(obj.seats ?? 1),
    runs_per_month: Number(obj.runs_per_month ?? 100),
    tokens_per_month: Number(obj.tokens_per_month ?? 100_000),
    cost_usd_per_month: Number(obj.cost_usd_per_month ?? 100),
  };
}

export function parseFeatures(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((f): f is string => typeof f === "string") : [];
}

export function toPlan(row: Record<string, unknown>): BillingPlan {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name || "Starter"),
    price_usd: Number(row.price_usd ?? 0),
    billing_interval: String(row.billing_interval || "monthly") as BillingPlan["billing_interval"],
    limits: parseLimits(row.limits),
    features: parseFeatures(row.features),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function toMeter(row: Record<string, unknown>): UsageMeter {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    plan_id: row.plan_id ? String(row.plan_id) : null,
    name: String(row.name) as MeterName,
    current_value: Number(row.current_value ?? 0),
    limit_value: Number(row.limit_value ?? 0),
    period_start: String(row.period_start),
    period_end: String(row.period_end),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function defaultMeters(planId: string, limits: PlanLimits): Omit<UsageMeter, "id" | "user_id" | "created_at" | "updated_at">[] {
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);
  const base = { plan_id: planId, period_start: now.toISOString(), period_end: end.toISOString() };
  return [
    { name: "seats" as const, current_value: 1, limit_value: limits.seats, ...base },
    { name: "runs" as const, current_value: 0, limit_value: limits.runs_per_month, ...base },
    { name: "tokens" as const, current_value: 0, limit_value: limits.tokens_per_month, ...base },
    { name: "cost_usd" as const, current_value: 0, limit_value: limits.cost_usd_per_month, ...base },
  ];
}

export function meterForLimit(meterName: keyof PlanLimits): MeterName {
  return LIMIT_TO_METER[meterName];
}

export function checkEntitlement(
  plan: BillingPlan,
  meters: UsageMeter[],
  deltas: Partial<Record<MeterName, number>> = {},
): EnforcementResult {
  const checks: EntitlementCheck[] = [];
  const meterMap = new Map(meters.map((m) => [m.name, m]));

  (Object.keys(LIMIT_TO_METER) as Array<keyof PlanLimits>).forEach((limitKey) => {
    const meterName = LIMIT_TO_METER[limitKey];
    const meter = meterMap.get(meterName);
    const limit = meter?.limit_value ?? plan.limits[limitKey];
    const current = (meter?.current_value ?? 0) + (deltas[meterName] ?? 0);
    const remaining = Math.max(0, limit - current);
    const pct = limit > 0 ? current / limit : 0;
    const ok = current <= limit;
    checks.push({
      ok,
      meter: meterName,
      current,
      limit,
      remaining,
      pct,
      reason: ok
        ? `${METER_LABELS[meterName]} within limit (${current.toLocaleString()} / ${limit.toLocaleString()})`
        : `${METER_LABELS[meterName]} limit exceeded (${current.toLocaleString()} > ${limit.toLocaleString()})`,
    });
  });

  const blocking = checks.filter((c) => !c.ok);
  return {
    allowed: blocking.length === 0,
    checks,
    blocking,
    upgradeRequired: blocking.some((c) => c.pct >= 1),
  };
}

export function formatMeterValue(name: MeterName, value: number): string {
  if (name === "cost_usd") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (name === "tokens" || name === "runs") return value.toLocaleString();
  return String(value);
}

export function planDisplayName(plan: BillingPlan): string {
  return `${plan.name} · $${plan.price_usd}/${plan.billing_interval === "annual" ? "yr" : "mo"}`;
}
