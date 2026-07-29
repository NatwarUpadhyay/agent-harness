import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, FolderKanban, Search, X, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";

interface Project { id: string; name: string; status: string; agents: number; modified: string; owner: string }

const SEED: Project[] = [
  { id: "p1", name: "Sales agent fleet",       status: "active",  agents: 12, modified: "2h ago",  owner: "AK" },
  { id: "p2", name: "Support copilot",         status: "active",  agents: 6,  modified: "5h ago",  owner: "MR" },
  { id: "p3", name: "Research summarizer",     status: "idle",    agents: 3,  modified: "1d ago",  owner: "JS" },
  { id: "p4", name: "Finance compliance",      status: "active",  agents: 8,  modified: "2d ago",  owner: "DL" },
  { id: "p5", name: "Onboarding orchestrator", status: "error",   agents: 4,  modified: "3d ago",  owner: "AK" },
  { id: "p6", name: "Knowledge ingestion",     status: "idle",    agents: 2,  modified: "5d ago",  owner: "MR" },
];

const KEY = "harness.projects.v1";
const FILTERS = ["all", "active", "idle", "error"] as const;

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Harness" },
      { name: "description", content: "Group agents, prompts, and evaluations by initiative." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const [rows, setRows] = useState<Project[]>(SEED);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", owner: "AK", agents: 1 });

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setRows(JSON.parse(raw)); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* ignore */ }
  }, [rows]);

  const remove = (id: string, name: string) => {
    setRows((r) => r.filter((p) => p.id !== id));
    toast.success(`Project “${name}” deleted`);
  };

  const create = () => {
    if (draft.name.trim().length < 2) { toast.error("Give the project a name"); return; }
    const p: Project = {
      id: `p_${Date.now()}`, name: draft.name.trim(), status: "idle",
      agents: Math.max(0, Number(draft.agents) || 0), modified: "just now",
      owner: draft.owner.slice(0, 2).toUpperCase() || "ME",
    };
    setRows((r) => [p, ...r]);
    setDraft({ name: "", owner: "AK", agents: 1 });
    setCreating(false);
    toast.success(`Project “${p.name}” created`);
  };

  const visible = useMemo(
    () => rows.filter((p) =>
      (filter === "all" || p.status === filter) &&
      p.name.toLowerCase().includes(q.trim().toLowerCase())),
    [rows, q, filter],
  );

  const cols: Column<Project>[] = [
    { key: "name", header: "Project", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "agents", header: "Agents", render: (r) => <span className="font-mono-tabular text-[var(--text-secondary)]">{r.agents}</span> },
    { key: "modified", header: "Last modified", render: (r) => <span className="text-[var(--text-muted)] text-[12px]">{r.modified}</span> },
    { key: "owner", header: "Owner", render: (r) => (
      <div className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent-muted)] text-[10px] text-[var(--text-accent)] font-semibold">{r.owner}</div>
    ) },
    { key: "actions", header: "", align: "right", render: (r) => (
      <button
        onClick={() => remove(r.id, r.name)}
        aria-label={`Delete ${r.name}`}
        className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    ) },
  ];

  const totalAgents = rows.reduce((s, p) => s + p.agents, 0);

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Group agents, prompts, and evaluations by initiative"
        actions={
          <button
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
          >
            {creating ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {creating ? "Cancel" : "New project"}
          </button>
        }
      />

      {creating && (
        <div className="mb-4 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            autoFocus placeholder="Project name" value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && create()}
            className="sm:col-span-2 h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 text-[13px] focus:outline-none focus:border-[var(--accent)]"
          />
          <input
            placeholder="Owner initials" value={draft.owner}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
            className="h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 text-[13px] focus:outline-none focus:border-[var(--accent)]"
          />
          <button onClick={create} className="h-9 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium">
            Create project
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…"
            className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] pl-8 pr-3 text-[13px] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f} onClick={() => setFilter(f)}
              className={`h-9 px-3 rounded-md text-[12px] capitalize border transition-colors ${
                filter === f
                  ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--text-primary)]"
                  : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 text-[13px] text-[var(--text-secondary)]">
        <FolderKanban className="h-4 w-4" /> {visible.length} shown · {rows.length} projects · {totalAgents} agents total
      </div>
      <DataTable columns={cols} rows={visible} />
    </>
  );
}
