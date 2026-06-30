import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { HarnessCanvas } from "@/features/harness/HarnessCanvas";

export const Route = createFileRoute("/_authenticated/harness")({
  head: () => ({ meta: [{ title: "Harness — Workflow canvas" }] }),
  component: () => (
    <>
      <PageHeader
        title="Harness"
        subtitle="Compose agent workflows visually — every node is a hot-swappable runtime"
      />
      <HarnessCanvas />
    </>
  ),
});
