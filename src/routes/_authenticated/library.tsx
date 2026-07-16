import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { usePublicWorkflows, useCloneWorkflow, type WorkflowRow } from "@/lib/hooks/use-entities";
import { Search, Copy, Share2, Workflow as WorkflowIcon, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Community library — Harness" },
      { name: "description", content: "Browse and clone public workflows shared across the org." },
    ],
  }),
  component: LibraryPage,
});

function nodeCount(wf: WorkflowRow): number {
  return Array.isArray(wf.nodes) ? (wf.nodes as unknown[]).length : 0;
}
function edgeCount(wf: WorkflowRow): number {
  return Array.isArray(wf.edges) ? (wf.edges as unknown[]).length : 0;
}

function LibraryPage() {
  const { data: workflows = [], isLoading } = usePublicWorkflows();
  const clone = useCloneWorkflow();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return workflows;
    return workflows.filter(
      (w) =>
        w.name.toLowerCase().includes(needle) ||
        (w.description ?? "").toLowerCase().includes(needle),
    );
  }, [workflows, q]);

  async function onClone(wf: WorkflowRow) {
    try {
      await clone.mutateAsync(wf);
      toast.success(`Cloned "${wf.name}" to your workspace`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clone");
    }
  }

  return (
    <div>
      <PageHeader
        title="Community library"
        subtitle="Public workflows shared across the org. Clone any into your workspace to edit and simulate."
      />

      <div className="mb-6 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2">
        <Search className="h-4 w-4 text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search public workflows…"
          className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--text-muted)]"
        />
        <span className="text-[12px] text-[var(--text-muted)]">
          {filtered.length} / {workflows.length}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[14px] text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading library…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-1)] px-6 py-16 text-center">
          <WorkflowIcon className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-3 text-[14px] text-[var(--text-secondary)]">
            No public workflows yet. Share one from the Harness canvas to seed the library.
          </p>
          <Link
            to="/harness"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--accent)] hover:underline"
          >
            Open harness <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((wf) => (
            <div
              key={wf.id}
              className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-4 transition-colors hover:border-[var(--accent)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <WorkflowIcon className="h-4 w-4 text-[var(--accent)]" />
                    <h3 className="truncate text-[14px] font-medium">{wf.name}</h3>
                  </div>
                  {wf.description && (
                    <p className="mt-1 line-clamp-2 text-[12px] text-[var(--text-secondary)]">
                      {wf.description}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Public
                </span>
              </div>

              <div className="mt-3 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                <span>{nodeCount(wf)} nodes</span>
                <span>·</span>
                <span>{edgeCount(wf)} edges</span>
                <span>·</span>
                <span>Updated {new Date(wf.updated_at).toLocaleDateString()}</span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => onClone(wf)}
                  disabled={clone.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" /> Clone to workspace
                </button>
                <Link
                  to="/share/$id"
                  params={{ id: wf.id }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                >
                  <Share2 className="h-3.5 w-3.5" /> Preview
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
