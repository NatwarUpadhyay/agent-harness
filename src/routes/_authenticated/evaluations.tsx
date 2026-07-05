import { createFileRoute } from "@tanstack/react-router";
import { EvaluationsView } from "@/features/evaluations/EvaluationsView";

export const Route = createFileRoute("/_authenticated/evaluations")({
  head: () => ({ meta: [{ title: "Evaluations — Harness" }] }),
  component: EvaluationsView,
});
