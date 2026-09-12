import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { usePublicWorkflows, useCloneWorkflow, type WorkflowRow } from "@/lib/hooks/use-entities";
import { listWorkspacePrompts, deleteWorkspacePrompt, type WorkspacePrompt } from "@/lib/data/prompts.functions";
import { useServerFn } from "@tanstack/react-start";
import { Search, Copy, Share2, Workflow as WorkflowIcon, ExternalLink, Loader2, MessageSquareText, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Library — Harness" },
      { name: "description", content: "Browse public workflows and workspace-shared prompts." },
    ],
  }),
  component: LibraryPage,
});

type Tab = "workflows" | "prompts";

function nodeCount(wf: WorkflowRow): number {
  return Array.isArray(wf.nodes) ? (wf.nodes as unknown[]).length : 0;
}
function edgeCount(wf: WorkflowRow): number {
  return Array.isArray(wf.edges) ? (wf.edges as unknown[]).length : 0;
}

function LibraryPage() {
  const [tab, setTab] = useState<Tab>("workflows");
  const { data: workflows = [], isLoading: wfLoading } = usePublicWorkflows();
  const fetchPrompts = useServerFn(listWorkspacePrompts);
  const doDeletePrompt = useServerFn(deleteWorkspacePrompt);
  const { data: prompts = [], isLoading: promptLoading } = useQuery({
    queryKey: ["workspace-prompts"],
    queryFn: () => fetchPrompts(),
  });
  const clone = useCloneWorkflow();
  const deletePrompt = useMutation({
    mutationFn: (vars: { id: string }) => doDeletePrompt({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-prompts"] });
      toast.success("Prompt deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete prompt"),
  });
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");

  const filteredWorkflows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return workflows;
    return workflows.filter(
      (w) =>
        w.name.toLowerCase().includes(needle) ||
        (w.description ?? "").toLowerCase().includes(needle),
    );
  }, [workflows, q]);

  const filteredPrompts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return prompts;
    return prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle) ||
        p.tags.some((t) => t.toLowerCase().includes(needle)),
    );
  }, [prompts, q]);

  async function onClone(wf: WorkflowRow) {
    try {
      await clone.mutateAsync(wf);
      toast.success(`Cloned "${wf.name}" to your workspace`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clone");
    }
  }

  const isLoading = tab === "workflows" ? wfLoading : promptLoading;
  const activeCount = tab === "workflows" ? filteredWorkflows.length : filteredPrompts.length;
  const totalCount = tab === "workflows" ? workflows.length : prompts.length;

  return (
    <div>
      <PageHeader
        title="Library"
        subtitle="Public workflows and workspace-shared prompts. Clone anything into your own workspace."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-1">
          <button
            onClick={() => setTab("workflows")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              tab === "workflows"
                ? "bg-[var(--accent-muted)] text-[var(--text-accent)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <WorkflowIcon className="h-3.5 w-3.5" /> Workflows
          </button>
          <button
            onClick={() => setTab("prompts")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              tab === "prompts"
                ? "bg-[var(--accent-muted)] text-[var(--text-accent)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <MessageSquareText className="h-3.5 w-3.5" /> Prompts
          </button>
        </div>

        <div className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2">
          <Search className="h-4 w-4 text-[var(--text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "workflows" ? "Search public workflows…" : "Search workspace prompts…"}
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--text-muted)]"
          />
          <span className="text-[12px] text-[var(--text-muted)]">
            {activeCount} / {totalCount}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[14px] text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : tab === "workflows" ? (
        filteredWorkflows.length === 0 ? (
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
            {filteredWorkflows.map((wf) => (
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
        )
      ) : filteredPrompts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-1)] px-6 py-16 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-3 text-[14px] text-[var(--text-secondary)]">
            No workspace prompts yet. Share one from the Prompts page to make it visible to the team.
          </p>
          <Link
            to="/prompts"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--accent)] hover:underline"
          >
            Open prompts <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredPrompts.map((p) => (
            <PromptCard key={p.id} prompt={p} onDelete={() => deletePrompt.mutate({ id: p.id })} />
          ))}
        </div>
      )}
    </div>
  );
}

function PromptCard({ prompt, onDelete }: { prompt: WorkspacePrompt; onDelete: () => void }) {
  const latest = prompt.versions[prompt.versions.length - 1];
  const variables = useMemo(() => {
    const set = new Set<string>();
    const re = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    const body = latest?.body ?? "";
    while ((m = re.exec(body))) set.add(m[1]);
    return [...set];
  }, [latest?.body]);

  return (
    <div className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-4 transition-colors hover:border-[var(--accent)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="truncate text-[14px] font-medium">{prompt.name}</h3>
          </div>
          <p className="mt-1 line-clamp-3 text-[12px] text-[var(--text-secondary)] font-mono-tabular">
            {latest?.body ?? ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          Workspace
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
        <span className="capitalize">{prompt.category}</span>
        <span>·</span>
        <span>{prompt.versions.length} version{prompt.versions.length !== 1 ? "s" : ""}</span>
        <span>·</span>
        <span>{variables.length} variable{variables.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          to="/prompts"
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-black transition-opacity hover:opacity-90"
        >
          <BookOpen className="h-3.5 w-3.5" /> Open
        </Link>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:border-[var(--text-danger)] hover:text-[var(--text-danger)]"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
