import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Plus } from "lucide-react";

interface Prompt { id: string; name: string; category: string; version: string; edited: string }
const prompts: Prompt[] = [
  { id: "p1", name: "sales/discovery-call.v3",      category: "sales",     version: "v3.2", edited: "3h ago" },
  { id: "p2", name: "support/triage-router",        category: "support",   version: "v1.8", edited: "1d ago" },
  { id: "p3", name: "research/paper-summary",       category: "research",  version: "v2.0", edited: "2d ago" },
  { id: "p4", name: "compliance/pii-redactor",      category: "safety",    version: "v4.1", edited: "5d ago" },
  { id: "p5", name: "planner/task-decomposer",      category: "planner",   version: "v7.0", edited: "1w ago" },
  { id: "p6", name: "tools/sql-author",             category: "tools",     version: "v2.4", edited: "2w ago" },
  { id: "p7", name: "evaluator/citation-judge",     category: "eval",      version: "v1.3", edited: "3w ago" },
];

const tags = ["All", "sales", "support", "research", "safety", "planner", "tools", "eval"];

const cols: Column<Prompt>[] = [
  { key: "name", header: "Name", render: (r) => <span className="font-mono-tabular text-[var(--text-primary)]">{r.name}</span> },
  { key: "category", header: "Category", render: (r) => <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-[var(--accent-muted)] text-[var(--text-accent)] capitalize">{r.category}</span> },
  { key: "version", header: "Version", render: (r) => <span className="font-mono-tabular text-[12px]">{r.version}</span> },
  { key: "edited", header: "Last edited", render: (r) => <span className="text-[12px] text-[var(--text-muted)]">{r.edited}</span> },
];

export const Route = createFileRoute("/_authenticated/prompts")({
  head: () => ({ meta: [{ title: "Prompt library — Harness" }] }),
  component: () => (
    <>
      <PageHeader
        title="Prompt library"
        subtitle="Versioned prompts with diffable history and tagged provenance"
        actions={<button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium"><Plus className="h-3.5 w-3.5" /> New prompt</button>}
      />
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {tags.map((t, i) => (
          <button key={t} className={`h-7 px-2.5 rounded-full text-[12px] border ${i === 0 ? "bg-[var(--accent-muted)] border-[var(--accent-border)] text-[var(--text-accent)]" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`}>{t}</button>
        ))}
      </div>
      <DataTable columns={cols} rows={prompts} />
    </>
  ),
});
