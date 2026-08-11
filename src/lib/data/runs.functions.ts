import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const runInput = z.object({
  workflowId: z.string().uuid(),
  input: z.string().min(1).max(4000),
});

export const listRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("workflow_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(`Failed to load runs: ${error.message}`);
    return data ?? [];
  });

export const deleteRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("workflow_runs").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to delete run: ${error.message}`);
    return { id: data.id };
  });

export const runWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => runInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: workflow, error: wfError } = await supabase
      .from("workflows")
      .select("id, name, nodes, edges")
      .eq("id", data.workflowId)
      .maybeSingle();

    if (wfError) throw new Error(`Failed to load workflow: ${wfError.message}`);
    if (!workflow) throw new Error("Workflow not found");

    const { executeGraph } = await import("./runs.server");
    const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as never[];
    const edges = (Array.isArray(workflow.edges) ? workflow.edges : []) as never[];
    if (nodes.length === 0) throw new Error("This workflow has no nodes to execute.");

    const result = await executeGraph(nodes, edges, data.input);

    const { data: row, error } = await supabase
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

    if (error) throw new Error(`Failed to persist run: ${error.message}`);
    return row;
  });

/** Re-executes a previous run's workflow with the same input (failed nodes get fresh retries). */
export const retryRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: previous, error: prevError } = await supabase
      .from("workflow_runs")
      .select("id, workflow_id, workflow_name, input")
      .eq("id", data.id)
      .maybeSingle();
    if (prevError) throw new Error(`Failed to load run: ${prevError.message}`);
    if (!previous?.workflow_id) throw new Error("Original workflow is no longer available.");

    const { data: workflow, error: wfError } = await supabase
      .from("workflows")
      .select("id, name, nodes, edges")
      .eq("id", previous.workflow_id)
      .maybeSingle();
    if (wfError) throw new Error(`Failed to load workflow: ${wfError.message}`);
    if (!workflow) throw new Error("Workflow not found");

    const { executeGraph } = await import("./runs.server");
    const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as never[];
    const edges = (Array.isArray(workflow.edges) ? workflow.edges : []) as never[];
    if (nodes.length === 0) throw new Error("This workflow has no nodes to execute.");

    const result = await executeGraph(nodes, edges, previous.input);

    const { data: row, error } = await supabase
      .from("workflow_runs")
      .insert({
        user_id: userId,
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        status: result.status,
        input: previous.input,
        output: result.output,
        steps: result.steps as unknown as import("@/integrations/supabase/types").Json,
        total_tokens: result.totalTokens,
        cost_usd: result.costUsd,
        latency_ms: result.latencyMs,
        error: result.error ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to persist retry: ${error.message}`);
    return row;
  });
