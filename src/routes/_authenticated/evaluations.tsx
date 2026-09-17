import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { EvaluationsView } from "@/features/evaluations/EvaluationsView";
import { createEvalRun, listEvalRuns, type StoredEvalRun } from "@/lib/data/evals.functions";
import { rubrics, type EvalRun } from "@/lib/data/evals";
import { useAgents } from "@/lib/hooks/use-entities";

function toEvalRun(row: StoredEvalRun): EvalRun {
  return {
    id: row.id,
    name: row.name,
    agentId: row.agent_id,
    datasetId: row.dataset_id,
    rubricIds: rubrics.map((r) => r.id),
    score: row.score,
    passRate: row.pass_rate,
    cases: row.cases,
    passed: row.passed,
    failed: row.failed,
    avgLatencyMs: row.avg_latency_ms,
    costUsd: row.cost_usd,
    startedAt: row.started_at,
    durationSec: row.duration_sec,
    status: (row.status as EvalRun["status"]) ?? "completed",
    perRubric: row.per_rubric,
  };
}

function LiveEvaluations() {
  const queryClient = useQueryClient();
  const fetchRuns = useServerFn(listEvalRuns);
  const runEval = useServerFn(createEvalRun);
  const { data: agents } = useAgents();

  const { data: rows } = useQuery({
    queryKey: ["eval-runs"],
    queryFn: () => fetchRuns(),
  });

  const mutation = useMutation({
    mutationFn: (input: { agentId: string; agentName: string; datasetId: string }) =>
      runEval({ data: input }),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["eval-runs"] });
      toast.success(`Evaluation finished — score ${Math.round(run.score)}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const runs = useMemo(() => (rows ?? []).map(toEvalRun), [rows]);
  const agentOptions = useMemo(
    () => (agents ?? []).map((a) => ({ id: a.id, name: a.name })),
    [agents],
  );

  return (
    <EvaluationsView
      runs={runs}
      agentOptions={agentOptions}
      onRun={(input) => mutation.mutateAsync(input)}
      running={mutation.isPending}
    />
  );
}

export const Route = createFileRoute("/_authenticated/evaluations")({
  head: () => ({
    meta: [
      { title: "Evaluations — Harness" },
      {
        name: "description",
        content:
          "Run agents against curated datasets, score them by rubric, and compare candidates head-to-head in Harness.",
      },
      { property: "og:title", content: "Evaluations — Harness" },
      {
        property: "og:description",
        content: "Workspace-shared evaluation history, rubric scoring, and head-to-head run comparison.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveEvaluations,
});
