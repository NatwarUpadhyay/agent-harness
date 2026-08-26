import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_BUDGETS = [
  { team: "Platform", cap: 4000, spent: 2740, enforcement: "throttle", active: true, period: "monthly" },
  { team: "Support AI", cap: 2500, spent: 2410, enforcement: "block", active: true, period: "monthly" },
  { team: "Research", cap: 1800, spent: 690, enforcement: "notify", active: true, period: "monthly" },
  { team: "Finance", cap: 900, spent: 934, enforcement: "block", active: true, period: "monthly" },
  { team: "Growth", cap: 1200, spent: 380, enforcement: "notify", active: false, period: "quarterly" },
];

const budgetSchema = z.object({
  team: z.string().min(1).max(120),
  cap: z.number().min(0),
  spent: z.number().min(0).default(0),
  enforcement: z.enum(["notify", "throttle", "block"]).default("notify"),
  active: z.boolean().default(true),
  period: z.enum(["monthly", "quarterly"]).default("monthly"),
});

const updateSchema = budgetSchema.partial().extend({ id: z.string().uuid() });
const idSchema = z.object({ id: z.string().uuid() });

export interface TeamBudget {
  id: string;
  user_id: string;
  team: string;
  cap: number;
  spent: number;
  enforcement: "notify" | "throttle" | "block";
  active: boolean;
  period: "monthly" | "quarterly";
  created_at: string;
  updated_at: string;
}

function toBudget(row: Record<string, unknown>): TeamBudget {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    team: String(row.team),
    cap: Number(row.cap),
    spent: Number(row.spent),
    enforcement: String(row.enforcement) as TeamBudget["enforcement"],
    active: Boolean(row.active),
    period: String(row.period) as TeamBudget["period"],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/** List the authenticated user's team budgets. */
export const listBudgets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("team_budgets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to load budgets: ${error.message}`);
    return (data ?? []).map(toBudget);
  });

/** Idempotently seed default budgets if the user has none. */
export const ensureDefaultBudgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error: countError } = await context.supabase
      .from("team_budgets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId);
    if (countError) throw new Error(`Failed to check budgets: ${countError.message}`);
    if ((count ?? 0) > 0) return { seeded: false };

    const inserts = DEFAULT_BUDGETS.map((b) => ({ ...b, user_id: context.userId }));
    const { error } = await context.supabase.from("team_budgets").insert(inserts);
    if (error) throw new Error(`Failed to seed budgets: ${error.message}`);
    return { seeded: true };
  });

/** Create a new team budget. */
export const createBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => budgetSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("team_budgets")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(`Failed to create budget: ${error.message}`);
    return toBudget(row);
  });

/** Update an existing team budget. */
export const updateBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("team_budgets")
      .update(patch)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update budget: ${error.message}`);
    return toBudget(row);
  });

/** Delete a team budget. */
export const deleteBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("team_budgets")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(`Failed to delete budget: ${error.message}`);
    return { id: data.id };
  });
