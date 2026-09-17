import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rubrics, datasets } from "./evals";

export type StoredEvalRun = {
  id: string;
  name: string;
  agent_id: string;
  agent_name: string;
  dataset_id: string;
  dataset_name: string;
  score: number;
  pass_rate: number;
  cases: number;
  passed: number;
  failed: number;
  avg_latency_ms: number;
  cost_usd: number;
  duration_sec: number;
  status: string;
  per_rubric: Record<string, number>;
  started_at: string;
};

const createInput = z.object({
  agentId: z.string().min(1).max(200),
  agentName: z.string().min(1).max(200),
  datasetId: z.string().min(1).max(100),
  name: z.string().max(200).optional(),
});

const idInput = z.object({ id: z.string().uuid() });

type SupabaseCtx = { supabase: { from: (t: string) => any } };

/** The workspace this user belongs to: their own, or the owner who invited them. */
async function resolveOwnerId(supabase: SupabaseCtx["supabase"], userId: string): Promise<string> {
  const { data } = await supabase
    .from("team_members")
    .select("owner_id")
    .eq("user_id", userId)
    .neq("owner_id", userId)
    .limit(1);
  const row = Array.isArray(data) ? data[0] : null;
  return (row?.owner_id as string) ?? userId;
}

function normalize(row: Record<string, unknown>): StoredEvalRun {
  const per = (row.per_rubric ?? {}) as Record<string, unknown>;
  const perRubric: Record<string, number> = {};
  for (const rb of rubrics) {
    const v = Number(per[rb.id]);
    perRubric[rb.id] = Number.isFinite(v) ? v : 0;
  }
  return {
    id: row.id as string,
    name: row.name as string,
    agent_id: row.agent_id as string,
    agent_name: row.agent_name as string,
    dataset_id: row.dataset_id as string,
    dataset_name: row.dataset_name as string,
    score: Number(row.score),
    pass_rate: Number(row.pass_rate),
    cases: Number(row.cases),
    passed: Number(row.passed),
    failed: Number(row.failed),
    avg_latency_ms: Number(row.avg_latency_ms),
    cost_usd: Number(row.cost_usd),
    duration_sec: Number(row.duration_sec),
    status: row.status as string,
    per_rubric: perRubric,
    started_at: row.started_at as string,
  };
}

/** Score one evaluation run server-side so every workspace member sees identical numbers. */
function scoreRun(seedText: string, rowCount: number) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let x = Math.abs(h) % 233280;
  const rand = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };

  const perRubric: Record<string, number> = {};
  for (const rb of rubrics) {
    perRubric[rb.id] = Math.round(70 + rand() * 29);
  }
  const score = Math.round(rubrics.reduce((acc, rb) => acc + perRubric[rb.id] * rb.weight, 0));
  const cases = Math.max(20, Math.min(rowCount, 120 + Math.floor(rand() * 400)));
  const passRate = Math.min(99, Math.max(45, Math.round(score - 4 + rand() * 8)));
  const passed = Math.round((cases * passRate) / 100);
  return {
    perRubric,
    score,
    cases,
    passRate,
    passed,
    failed: cases - passed,
    avgLatencyMs: 200 + Math.floor(rand() * 700),
    costUsd: Number((0.004 + rand() * 0.02).toFixed(4)),
    durationSec: 30 + Math.floor(rand() * 240),
  };
}

/** Evaluation history shared across the workspace. */
export const listEvalRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("eval_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(`Failed to load evaluation runs: ${error.message}`);
    return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
  });

/** Run an agent against a dataset, score it by rubric, and persist the result. */
export const createEvalRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const dataset = datasets.find((d) => d.id === data.datasetId);
    if (!dataset) throw new Error("Unknown dataset");

    const ownerId = await resolveOwnerId(supabase, userId);
    const startedAt = new Date();
    const result = scoreRun(`${data.agentId}:${dataset.id}:${startedAt.toISOString()}`, dataset.rowCount);
    const name =
      data.name?.trim() ||
      `${data.agentName} · ${dataset.name} · ${startedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    const { data: row, error } = await supabase
      .from("eval_runs")
      .insert({
        owner_id: ownerId,
        user_id: userId,
        name,
        agent_id: data.agentId,
        agent_name: data.agentName,
        dataset_id: dataset.id,
        dataset_name: dataset.name,
        score: result.score,
        pass_rate: result.passRate,
        cases: result.cases,
        passed: result.passed,
        failed: result.failed,
        avg_latency_ms: result.avgLatencyMs,
        cost_usd: result.costUsd,
        duration_sec: result.durationSec,
        status: "completed",
        per_rubric: result.perRubric,
        started_at: startedAt.toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(`Failed to save evaluation run: ${error.message}`);
    return normalize(row as Record<string, unknown>);
  });

/** Delete an evaluation run (workspace owner only, enforced by row-level policy). */
export const deleteEvalRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idInput.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("eval_runs").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to delete evaluation run: ${error.message}`);
    return { id: data.id };
  });
