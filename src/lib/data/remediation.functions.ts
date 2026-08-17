import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateRemediation, normalizePolicy } from "./remediation-policy";
import {
  evaluateTeamBudget,
  normalizeTeam,
  resolveEffectivePolicy,
  teamUsage,
  type TeamBudget,
} from "./remediation-teams";
import { enterpriseAuthSchema } from "./enterprise-auth";

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
  /** Team the rule belongs to — its daily budget and overrides apply. */
  teamId: z.string().max(64).optional(),
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
    const humanInitiated = data.humanInitiated ?? false;

    // Guardrail inheritance: org defaults -> team overrides -> rule overrides.
    const { data: orgRow } = await supabase
      .from("org_settings")
      .select("config")
      .eq("user_id", userId)
      .maybeSingle();
    const org = enterpriseAuthSchema.parse(orgRow?.config ?? {});
    const team: TeamBudget | null = data.teamId
      ? (org.remediationTeams.find((t) => t.id === data.teamId) as TeamBudget | undefined) ?? null
      : null;
    const policy = resolveEffectivePolicy({
      orgDefaults: org.remediationDefaults,
      team,
      rulePolicy: normalizePolicy(data.policy),
    });

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
    let decision = evaluateRemediation({
      policy,
      history: (history ?? []).map((h) => new Date(h.created_at).getTime()),
      now,
      humanInitiated,
    });

    // A team that has spent its rolling-day budget cannot remediate again,
    // not even by hand — the budget is the blast radius, not a suggestion.
    if (team && decision.outcome === "allow") {
      const normalized = normalizeTeam(team);
      const { data: teamHistory } = await supabase
        .from("remediation_attempts")
        .select("created_at, outcome, team_id")
        .eq("team_id", normalized.id)
        .gte("created_at", since)
        .limit(500);
      const verdict = evaluateTeamBudget(
        normalized,
        teamUsage(teamHistory ?? [], normalized.id, now),
      );
      if (verdict.exceeded) {
        decision = { outcome: "blocked", reason: verdict.reason ?? "Team budget exhausted" };
      }
    }

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
          team_id: team ? team.id : null,
          team_name: team ? team.name : null,
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
        policy,
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
      policy,
      workflowName: workflow.name,
      run,
    };
  });
