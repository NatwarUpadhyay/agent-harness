import { createFileRoute } from "@tanstack/react-router";
import { Upload, FileSpreadsheet, FileText, FileJson } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

const datasets = [
  { id: "d1", name: "support_tickets_2025_q2.parquet", type: "parquet", rows: 184_233, size: "248 MB", created: "2025-06-12", icon: FileSpreadsheet },
  { id: "d2", name: "golden_eval_set.jsonl",           type: "jsonl",   rows: 1_200,   size: "4.2 MB",  created: "2025-05-30", icon: FileJson },
  { id: "d3", name: "policy_documents.md",             type: "markdown",rows: 412,     size: "1.8 MB",  created: "2025-05-22", icon: FileText },
  { id: "d4", name: "sales_call_transcripts.csv",      type: "csv",     rows: 6_420,   size: "92 MB",   created: "2025-05-10", icon: FileSpreadsheet },
  { id: "d5", name: "redteam_prompts.jsonl",           type: "jsonl",   rows: 384,     size: "0.9 MB",  created: "2025-04-28", icon: FileJson },
  { id: "d6", name: "compliance_corpus.parquet",       type: "parquet", rows: 3_188,   size: "31 MB",   created: "2025-04-15", icon: FileSpreadsheet },
];

export const Route = createFileRoute("/_authenticated/datasets")({
  head: () => ({ meta: [{ title: "Datasets — Harness" }] }),
  component: () => (
    <>
      <PageHeader
        title="Datasets"
        subtitle="Training, eval, and red-team corpora powering your agents"
        actions={
          <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium">
            <Upload className="h-3.5 w-3.5" /> Upload
          </button>
        }
      />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_120px_100px_120px] gap-4 px-5 py-2.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-elevated)]/60 border-b border-[var(--border-subtle)]">
          <span>Name</span><span>Type</span><span className="text-right">Rows</span><span className="text-right">Size</span><span className="text-right">Created</span>
        </div>
        {datasets.map((d) => {
          const Icon = d.icon;
          return (
            <div key={d.id} className="grid grid-cols-[1fr_100px_120px_100px_120px] gap-4 px-5 py-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/50">
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-[var(--text-muted)]" />
                <span className="font-mono-tabular text-[13px]">{d.name}</span>
              </div>
              <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-[var(--accent-muted)] text-[var(--text-accent)] self-center w-fit">{d.type}</span>
              <span className="font-mono-tabular text-[12px] text-right self-center">{d.rows.toLocaleString()}</span>
              <span className="font-mono-tabular text-[12px] text-right self-center text-[var(--text-secondary)]">{d.size}</span>
              <span className="font-mono-tabular text-[12px] text-right self-center text-[var(--text-muted)]">{d.created}</span>
            </div>
          );
        })}
      </div>
    </>
  ),
});
