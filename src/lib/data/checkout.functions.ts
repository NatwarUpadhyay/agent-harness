import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadOrSeedPlan, loadOrSeedMeters } from "./billing.functions";
import { parseLimits } from "./billing";
import type { Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppSupabaseClient = SupabaseClient<Database>;

const PLAN_CATALOG: Record<
  string,
  {
    name: string;
    price_usd: number;
    billing_interval: "monthly" | "annual";
    limits: { seats: number; runs_per_month: number; tokens_per_month: number; cost_usd_per_month: number };
    features: string[];
  }
> = {
  Starter: {
    name: "Starter",
    price_usd: 0,
    billing_interval: "monthly",
    limits: { seats: 1, runs_per_month: 100, tokens_per_month: 100_000, cost_usd_per_month: 100 },
    features: ["Canvas", "Simulate", "Usage analytics", "5 saved workflows"],
  },
  Team: {
    name: "Team",
    price_usd: 49,
    billing_interval: "monthly",
    limits: { seats: 10, runs_per_month: 5_000, tokens_per_month: 5_000_000, cost_usd_per_month: 1_000 },
    features: ["Everything in Starter", "Team seats", "Shared workflows", "API keys"],
  },
  Enterprise: {
    name: "Enterprise",
    price_usd: 299,
    billing_interval: "monthly",
    limits: { seats: 100, runs_per_month: 100_000, tokens_per_month: 100_000_000, cost_usd_per_month: 25_000 },
    features: ["Everything in Team", "SSO/SCIM", "Audit log", "SLOs & remediation"],
  },
};

function getStripe(): Stripe | null {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key || key.length < 10) return null;
  return new Stripe(key, { apiVersion: "2025-06-30.basil" });
}

const createCheckoutInput = z.object({
  planName: z.enum(["Starter", "Team", "Enterprise"]),
  billingInterval: z.enum(["monthly", "annual"]).default("monthly"),
});

/** Create a Stripe Checkout session for the selected plan. Falls back to sales hand-off when Stripe is not configured. */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createCheckoutInput.parse(data))
  .handler(async ({ context, data }) => {
    const { userId, supabase } = context;
    const plan = PLAN_CATALOG[data.planName];
    if (!plan) throw new Error("Unknown plan.");

    // Free plans don't need checkout; upgrade immediately.
    if (plan.price_usd === 0) {
      await applyPlanUpgrade(supabase, userId, plan);
      return { mode: "free-upgraded" as const, plan: plan.name };
    }

    const stripe = getStripe();
    if (!stripe) {
      return { mode: "contact-sales" as const, message: "Stripe is not configured. Our team will reach out to complete setup." };
    }

    const origin = process.env["ORIGIN"] || "http://localhost:8080";
    const product = await stripe.products.create({
      name: `Harness ${plan.name}`,
      description: plan.features.join(" · "),
    });

    const unitAmount = data.billingInterval === "annual" ? Math.round(plan.price_usd * 12 * 0.85) : plan.price_usd;
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount * 100,
      currency: "usd",
      recurring: { interval: data.billingInterval === "annual" ? "year" : "month" },
    });

    const authUser = await supabase.auth.getUser();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: authUser.data.user?.email,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: { userId, planName: plan.name },
      subscription_data: { metadata: { userId, planName: plan.name } },
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { mode: "stripe" as const, url: session.url };
  });

const provisionInput = z.object({ sessionId: z.string().min(1) });

/** Provision the purchased plan after a successful Stripe Checkout return. */
export const provisionPlanFromCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => provisionInput.parse(data))
  .handler(async ({ context, data }) => {
    const stripe = getStripe();
    if (!stripe) throw new Error("Stripe is not configured.");

    const session = await stripe.checkout.sessions.retrieve(data.sessionId);
    if (session.payment_status !== "paid") {
      throw new Error(`Payment status is ${session.payment_status}.`);
    }

    const planName = session.metadata?.planName;
    const plan = planName ? PLAN_CATALOG[planName] : null;
    if (!plan) throw new Error("Checkout session does not reference a valid Harness plan.");

    await applyPlanUpgrade(context.supabase, context.userId, plan);
    return { plan: plan.name };
  });

async function applyPlanUpgrade(
  supabase: AppSupabaseClient,
  userId: string,
  plan: (typeof PLAN_CATALOG)["Team"],
) {
  const existing = await loadOrSeedPlan(supabase, userId);
  const limits = parseLimits(plan.limits as Record<string, unknown>);

  const { error } = await supabase
    .from("billing_plans")
    .update({
      name: plan.name,
      price_usd: plan.price_usd,
      billing_interval: plan.billing_interval,
      limits: plan.limits as unknown as Json,
      features: plan.features as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to update billing plan: ${error.message}`);

  await loadOrSeedMeters(supabase, userId, { ...existing, limits } as unknown as Awaited<ReturnType<typeof loadOrSeedPlan>>);

  const limitMap: Record<"seats" | "runs" | "tokens" | "cost_usd", number> = {
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
}
