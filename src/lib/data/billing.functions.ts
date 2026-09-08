import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "crypto";
import { type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  toPlan,
  toMeter,
  parseLimits,
  defaultMeters,
  checkEntitlement,
  invoiceEstimate,
  type BillingPlan,
  type UsageMeter,
  type MeterName,
} from "./billing";

type AppSupabaseClient = SupabaseClient<Database>;

const DEFAULT_PLAN = {
  name: "Starter",
  price_usd: 0,
  billing_interval: "monthly" as const,
  limits: { seats: 1, runs_per_month: 100, tokens_per_month: 100_000, cost_usd_per_month: 100 },
  features: ["Canvas", "Simulate", "Usage analytics", "5 saved workflows"],
};

const METER_NAMES: MeterName[] = ["seats", "runs", "tokens", "cost_usd"];

export async function loadOrSeedPlan(supabase: AppSupabaseClient, userId: string): Promise<BillingPlan> {
  const { data, error } = await supabase
    .from("billing_plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load billing plan: ${error.message}`);
  if (data) return toPlan(data as Record<string, unknown>);

  // Upsert on user_id so concurrent first-visit requests can't create duplicates.
  const { error: insertError } = await supabase
    .from("billing_plans")
    .upsert(
      {
        user_id: userId,
        name: DEFAULT_PLAN.name,
        price_usd: DEFAULT_PLAN.price_usd,
        billing_interval: DEFAULT_PLAN.billing_interval,
        limits: DEFAULT_PLAN.limits as unknown as Json,
        features: DEFAULT_PLAN.features as unknown as Json,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  if (insertError) throw new Error(`Failed to seed billing plan: ${insertError.message}`);

  const { data: row, error: reloadError } = await supabase
    .from("billing_plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (reloadError || !row) throw new Error(`Failed to load billing plan: ${reloadError?.message ?? "not found"}`);
  return toPlan(row as Record<string, unknown>);
}

export async function loadOrSeedMeters(supabase: AppSupabaseClient, userId: string, plan: BillingPlan): Promise<UsageMeter[]> {
  const { data, error } = await supabase
    .from("usage_meters")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load usage meters: ${error.message}`);
  if ((data ?? []).length === METER_NAMES.length) {
    return (data ?? []).map((m) => toMeter(m as Record<string, unknown>));
  }

  const inserts = defaultMeters(plan.id, plan.limits).map((m) => ({ ...m, user_id: userId }));
  const { error: insertError } = await supabase
    .from("usage_meters")
    .upsert(inserts as any, { onConflict: "user_id,name", ignoreDuplicates: true });

  if (insertError) throw new Error(`Failed to seed usage meters: ${insertError.message}`);

  const { data: rows, error: reloadError } = await supabase
    .from("usage_meters")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (reloadError) throw new Error(`Failed to load usage meters: ${reloadError.message}`);
  return (rows ?? []).map((m) => toMeter(m as Record<string, unknown>));
}




/** Get or seed the authenticated user's billing plan. */
export const getBillingPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return loadOrSeedPlan(context.supabase, context.userId);
  });

/** Get or seed usage meters for the authenticated user's plan. */
export const getUsageMeters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const plan = await loadOrSeedPlan(context.supabase, context.userId);
    return loadOrSeedMeters(context.supabase, context.userId, plan);
  });

const recordUsageInput = z.object({
  runs: z.number().min(0).optional(),
  tokens: z.number().min(0).optional(),
  cost_usd: z.number().min(0).optional(),
  sourceRunId: z.string().uuid().optional(),
});

function getStripe(): Stripe | null {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key || key.length < 10) return null;
  return new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
}

async function emitStripeMeterEvent(
  stripe: Stripe | null,
  meter: UsageMeter,
  plan: BillingPlan,
  delta: number,
): Promise<string | null> {
  if (!stripe || !plan.stripe_customer_id || !meter.stripe_meter_event_name) return null;
  try {
    const eventName = meter.stripe_meter_event_name;
    const identifier = `${plan.user_id}-${meter.name}-${Date.now()}-${randomUUID()}`;
    // Stripe Billing Meter Events API is nested under stripe.billing.meterEvents.
    const api = (stripe as any).billing?.meterEvents;
    if (!api?.create) return null;
    const event = await api.create({
      event_name: eventName,
      payload: {
        value: String(Math.round(delta)),
        stripe_customer_id: plan.stripe_customer_id,
      },
      identifier,
    });
    return event?.id ?? null;
  } catch {
    return null;
  }
}

async function recordMeterDelta(
  supabase: AppSupabaseClient,
  userId: string,
  plan: BillingPlan,
  meter: UsageMeter,
  delta: number,
  sourceRunId?: string,
) {
  const { error } = await supabase
    .from("usage_meters")
    .update({ current_value: meter.current_value + delta })
    .eq("id", meter.id)
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to update meter ${meter.name}: ${error.message}`);

  const stripeEventId = await emitStripeMeterEvent(getStripe(), meter, plan, delta);

  const { error: eventError } = await supabase.from("billing_usage_events").insert({
    user_id: userId,
    plan_id: plan.id,
    meter_name: meter.name,
    delta,
    description: sourceRunId ? `Run ${sourceRunId}` : "Usage recorded",
    source_run_id: sourceRunId ?? null,
    stripe_event_id: stripeEventId,
  } as any);
  if (eventError) throw new Error(`Failed to record usage event for ${meter.name}: ${eventError.message}`);
}

/** Atomically increment usage meters, write usage-event line items, and optionally
 *  mirror the event to Stripe Billing Meters when STRIPE_SECRET_KEY is configured. */
export const recordUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => recordUsageInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const plan = await loadOrSeedPlan(supabase, userId);
    const meters = await loadOrSeedMeters(supabase, userId, plan);

    const updates: Partial<Record<MeterName, number>> = {};
    if (data.runs) updates.runs = data.runs;
    if (data.tokens) updates.tokens = data.tokens;
    if (data.cost_usd) updates.cost_usd = data.cost_usd;

    for (const [name, delta] of Object.entries(updates)) {
      const meter = meters.find((m) => m.name === name);
      if (!meter) continue;
      await recordMeterDelta(supabase, userId, plan, meter, delta, data.sourceRunId);
    }

    return loadOrSeedMeters(supabase, userId, plan);
  });

/** Get the upcoming invoice estimate: base plan price plus metered overages. */
export const getInvoiceEstimate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const plan = await loadOrSeedPlan(supabase, userId);
    const meters = await loadOrSeedMeters(supabase, userId, plan);
    return invoiceEstimate(plan, meters);
  });

const checkPlanInput = z.object({
  runs: z.number().min(0).optional(),
  tokens: z.number().min(0).optional(),
  cost_usd: z.number().min(0).optional(),
});

/** Check whether a planned operation would violate plan limits without mutating meters. */
export const checkPlanEnforcement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => checkPlanInput.parse(data))
  .handler(async ({ context, data }) => {
    const plan = await loadOrSeedPlan(context.supabase, context.userId);
    const meters = await loadOrSeedMeters(context.supabase, context.userId, plan);
    return checkEntitlement(plan, meters, data);
  });

/** Change the user's plan tier (used for upgrades/downgrades in settings). */
export const updateBillingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      name: z.string().min(1).max(80),
      price_usd: z.number().min(0),
      billing_interval: z.enum(["monthly", "annual"]),
      limits: z.object({
        seats: z.number().int().min(1),
        runs_per_month: z.number().int().min(0),
        tokens_per_month: z.number().int().min(0),
        cost_usd_per_month: z.number().min(0),
      }),
      features: z.array(z.string()).default([]),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const plan = await loadOrSeedPlan(supabase, userId);

    const { error } = await supabase
      .from("billing_plans")
      .update({
        name: data.name,
        price_usd: data.price_usd,
        billing_interval: data.billing_interval,
        limits: data.limits as unknown as Json,
        features: data.features as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.id)
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to update billing plan: ${error.message}`);

    const limits = parseLimits(data.limits as Record<string, unknown>);
    const limitMap: Record<MeterName, number> = {
      seats: limits.seats,
      runs: limits.runs_per_month,
      tokens: limits.tokens_per_month,
      cost_usd: limits.cost_usd_per_month,
    };

    for (const [name, limit] of Object.entries(limitMap)) {
      const { error: meterError } = await supabase
        .from("usage_meters")
        .update({ limit_value: limit })
        .eq("user_id", userId)
        .eq("name", name);
      if (meterError) throw new Error(`Failed to sync meter ${name}: ${meterError.message}`);
    }

    return loadOrSeedPlan(supabase, userId);
  });

export type { BillingPlan, UsageMeter, MeterName };
