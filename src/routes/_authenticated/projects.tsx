import { createFileRoute } from "@tanstack/react-router";
import { Plus, FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

interface Project { id: string; name: string; status: string; agents: number; modified: string; owner: string }

const projects: Project[] = [
  { id: "p1", name: "Sales agent fleet",       status: "active",  agents: 12, modified: "2h ago",  owner: "AK" },
  { id: "p2", name: "Support copilot",         status: "active",  agents: 6,  modified: "5h ago",  owner: "MR" },
  { id: "p3", name: "Research summarizer",     status: "idle",    agents: 3,  modified: "1d ago",  owner: "JS" },
  { id: "p4", name: "Finance compliance",      status: "active",  agents: 8,  modified: "2d ago",  owner: "DL" },
  { id: "p5", name: "Onboarding orchestrator", status: "error",   agents: 4,  modified: "3d ago",  owner: "AK" },
  { id: "p6", name: "Knowledge ingestion",     status: "idle",    agents: 2,  modified: "5d ago",  owner: "MR" },
];

const cols: Column<Project>[] = [
  { key: "name", header: "Project", render: (r) => <span className="font-medium">{r.name}</span> },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "agents", header: "Agents", render: (r) => <span className="font-mono-tabular text-[var(--text-secondary)]">{r.agents}</span> },
  { key: "modified", header: "Last modified", render: (r) => <span className="text-[var(--text-muted)] text-[12px]">{r.modified}</span> },
  { key: "owner", header: "Owner", render: (r) => (
    <div className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent-muted)] text-[10px] text-[var(--text-accent)] font-semibold">{r.owner}</div>
  ) },
];

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Projects — Harness" }] }),
  component: () => (
    <>
      <PageHeader
        title="Projects"
        subtitle="Group agents, prompts, and evaluations by initiative"
        actions={
          <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]">
            <Plus className="h-3.5 w-3.5" /> New project
          </button>
        }
      />
      <div className="flex items-center gap-2 mb-4 text-[13px] text-[var(--text-secondary)]">
        <FolderKanban className="h-4 w-4" /> {projects.length} projects · 35 agents total
      </div>
      <DataTable columns={cols} rows={projects} />
    </>
  ),
});
