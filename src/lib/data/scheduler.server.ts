/**
 * Server-only scheduler: resolves a schedule row, executes its workflow through
 * the production execution engine and persists the resulting run.
 * Used by the cron tick endpoint and the public webhook trigger.
 */
import { executeGraph } from "./runs.server";
import { nextRunAt, type Recurrence } from "./schedules";

interface ScheduleRow {
  id: string;
  user_id: string;
  workflow_id: string;
  workflow_name: string;
  name: string;
  recurrence: string;
  trigger_kind: string;
  input: string;
  run_count: number;
}

export interface TriggerOutcome {
  scheduleId: string;
  scheduleName: string;
  runId: string | null;
  status: "succeeded" | "failed";
  error?: string;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function executeSchedule(
  schedule: ScheduleRow,
  overrideInput?: string,
): Promise<TriggerOutcome> {
  const db = await admin();

  const { data: workflow, error: wfError } = await db
    .from("workflows")
    .select("id, name, nodes, edges")
    .eq("id", schedule.workflow_id)
    .maybeSingle();

  const advance = async (status: string) => {
    await db
      .from("workflow_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunAt(schedule.recurrence as Recurrence).toISOString(),
        run_count: schedule.run_count + 1,
      })
      .eq("id", schedule.id);
    return status;
  };

  if (wfError || !workflow) {
    await advance("failed");
    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      status: "failed",
      error: wfError?.message ?? "Workflow no longer exists",
    };
  }

  const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as never[];
  const edges = (Array.isArray(workflow.edges) ? workflow.edges : []) as never[];

  if (nodes.length === 0) {
    await advance("failed");
    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      status: "failed",
      error: "Workflow has no nodes to execute",
    };
  }

  const input = (overrideInput?.trim() || schedule.input || `Scheduled run: ${schedule.name}`).slice(0, 4000);
  const result = await executeGraph(nodes, edges, input);

  const { data: run } = await db
    .from("workflow_runs")
    .insert({
      user_id: schedule.user_id,
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      status: result.status,
      input: `[${schedule.trigger_kind === "webhook" ? "webhook" : "scheduled"}: ${schedule.name}] ${input}`,
      output: result.output,
      steps: result.steps as unknown as never,
      total_tokens: result.totalTokens,
      cost_usd: result.costUsd,
      latency_ms: result.latencyMs,
      error: result.error ?? null,
    })
    .select("id")
    .single();

  await advance(result.status);

  return {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    runId: run?.id ?? null,
    status: result.status,
    error: result.error,
  };
}

/** Runs every enabled recurring schedule whose next_run_at is in the past. */
export async function runDueSchedules(limit = 5): Promise<TriggerOutcome[]> {
  const db = await admin();
  const { data, error } = await db
    .from("workflow_schedules")
    .select("*")
    .eq("enabled", true)
    .eq("trigger_kind", "recurring")
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to load due schedules: ${error.message}`);

  const outcomes: TriggerOutcome[] = [];
  for (const row of data ?? []) {
    outcomes.push(await executeSchedule(row as ScheduleRow));
  }
  return outcomes;
}

/** Resolves a webhook token to its schedule and fires it. */
export async function runByWebhookToken(
  token: string,
  overrideInput?: string,
): Promise<TriggerOutcome | null> {
  const db = await admin();
  const { data } = await db
    .from("workflow_schedules")
    .select("*")
    .eq("webhook_token", token)
    .eq("enabled", true)
    .maybeSingle();

  if (!data) return null;
  return executeSchedule(data as ScheduleRow, overrideInput);
}
