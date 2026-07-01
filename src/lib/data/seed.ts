import { supabase } from "@/integrations/supabase/client";
import { agents as seedAgents, tools as seedTools, experiments as seedExperiments } from "./synthetic";

/**
 * Seeds the signed-in user's account with realistic demo data if empty.
 * Runs once per session and short-circuits if any agent already exists.
 */
export async function seedIfEmpty(userId: string): Promise<boolean> {
  const { count, error: countErr } = await supabase
    .from("agents").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (countErr) return false;
  if ((count ?? 0) > 0) return false;

  const agentRows = seedAgents.map((a) => ({
    user_id: userId,
    name: a.name,
    model: a.model,
    status: a.status,
    success_rate: a.successRate,
    total_calls: a.totalCalls,
    avg_latency: a.avgLatency,
    last_active: a.lastActive,
  }));
  const toolRows = seedTools.map((t) => ({
    user_id: userId,
    name: t.name,
    category: t.category,
    call_count: t.callCount,
    success_rate: t.successRate,
    enabled: true,
  }));
  const expRows = seedExperiments.map((e) => ({
    user_id: userId,
    name: e.name,
    status: e.status,
    success_rate: e.successRate,
    avg_latency: e.avgLatency,
    cost_per_call: e.costPerCall,
    start_date: e.startDate,
  }));

  await Promise.all([
    supabase.from("agents").insert(agentRows),
    supabase.from("tools").insert(toolRows),
    supabase.from("experiments").insert(expRows),
  ]);
  return true;
}
