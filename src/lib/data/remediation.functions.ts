import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateRemediation, normalizePolicy } from "./remediation-policy";

const policySchema = z.object({
  mode: z.enum(["manual", "approval", "auto"]),
  maxPerHour: z.number().int().min(1).max(100),
  cooldownMinutes: z.number().min(0).max(1440),
});

const requestSchema = z.object({
  ruleId: z.string().min(1).max(64),
  ruleName: z.string().min(1).max(160),
  workflowId: z.string().uuid(),
  policy: policySchema,
  humanInitiated: z.boolean().optional(),
  input: z.string().min(1).max(4000),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Attempt ledger for the last 24h — powers the live guardrail budget in the UI. */
export const listRemediationAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const { data, error } = await context.supabase
      .from("remediation_attempts")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(`Failed to load remediation attempts: ${error.message}`);
    return data ?? [];
  });

/**
 * Server-side enforcement of a rule's remediation guardrails.
 *
 * The client can no longer talk itself past a cooldown or hourly cap: history
 * comes from the database, the pure policy decides, and only an `allow` outcome
 * executes the workflow. Every outcome is written to the ledger.
 */
export const requestRemediation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => requestSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const policy = normalizePolicy(data.policy);
    const humanInitiated = data.humanInitiated ?? false;

    const { data: workflow, error: wfError } = await supabase
      .from("workflows")
      .select("id, name, nodes, edges")
      .eq("id", data.workflowId)
      .maybeSingle();
    if (wfError) throw new Error(`Failed to load workflow: ${wfError.message}`);
    if (!workflow) throw new Error("Remediation workflow not found");

    const since = new Date(Date.now() - DAY_MS).toISOString();
    const { data: history, error: histError } = await supabase
      .from("remediation_attempts")
      .select("created_at")
      .eq("rule_id", data.ruleId)
      .eq("outcome", "allow")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);
    if (histError) throw new Error(`Failed to load attempt history: ${histError.message}`);

    const now = Date.now();
    const decision = evaluateRemediation({
      policy,
      history: (history ?? []).map((h) => new Date(h.created_at).getTime()),
      now,
      humanInitiated,
    });

    const record = async (patch: Record<string, unknown>) => {
      const { data: row } = await supabase
        .from("remediation_attempts")
        .insert({
          user_id: userId,
          rule_id: data.ruleId,
          rule_name: data.ruleName,
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          outcome: decision.outcome,
          reason: decision.reason,
          human_initiated: humanInitiated,
          ...patch,
        })
        .select()
        .single();
      return row;
    };

    if (decision.outcome !== "allow") {
      await record({});
      return {
        outcome: decision.outcome,
        reason: decision.reason,
        retryAfterMs: decision.retryAfterMs ?? null,
        workflowName: workflow.name,
        run: null,
      };
    }

    const attempt = await record({ run_status: "running" });

    const { executeGraph } = await import("./runs.server");
    const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as never[];
    const edges = (Array.isArray(workflow.edges) ? workflow.edges : []) as never[];
    if (nodes.length === 0) throw new Error("This remediation workflow has no nodes to execute.");

    const result = await executeGraph(nodes, edges, data.input);

    const { data: run, error: runError } = await supabase
      .from("workflow_runs")
      .insert({
        user_id: userId,
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        status: result.status,
        input: data.input,
        output: result.output,
        steps: result.steps as unknown as import("@/integrations/supabase/types").Json,
        total_tokens: result.totalTokens,
        cost_usd: result.costUsd,
        latency_ms: result.latencyMs,
        error: result.error ?? null,
      })
      .select()
      .single();
    if (runError) throw new Error(`Failed to persist remediation run: ${runError.message}`);

    if (attempt?.id) {
      await supabase
        .from("remediation_attempts")
        .update({ run_id: run.id, run_status: result.status })
        .eq("id", attempt.id);
    }

    return {
      outcome: "allow" as const,
      reason: decision.reason,
      retryAfterMs: null,
      workflowName: workflow.name,
      run,
    };
  });
