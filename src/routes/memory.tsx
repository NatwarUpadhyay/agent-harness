import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";

interface Namespace { id: string; name: string; rows: number; embedding: string; lastWrite: string }
const ns: Namespace[] = [
  { id: "n1", name: "support-tickets-2025",   rows: 184_233, embedding: "text-embedding-3-large", lastWrite: "1m ago" },
  { id: "n2", name: "product-docs",           rows: 12_900,  embedding: "text-embedding-3-large", lastWrite: "4h ago" },
  { id: "n3", name: "sales-call-transcripts", rows: 6_420,   embedding: "text-embedding-3-small", lastWrite: "12m ago" },
  { id: "n4", name: "internal-wiki",          rows: 21_007,  embedding: "voyage-3-large",         lastWrite: "2d ago" },
  { id: "n5", name: "compliance-corpus",      rows: 3_188,   embedding: "text-embedding-3-large", lastWrite: "1w ago" },
];

const stats = [
  { label: "Total vectors",   value: "227,748" },
  { label: "Namespaces",      value: "5" },
  { label: "Queries / sec",   value: "184.2" },
  { label: "Avg recall@10",   value: "92.7%" },
];

const cols: Column<Namespace>[] = [
  { key: "name", header: "Namespace", render: (r) => <span className="font-mono-tabular text-[var(--text-primary)]">{r.name}</span> },
  { key: "rows", header: "Rows", align: "right", render: (r) => <span className="font-mono-tabular">{r.rows.toLocaleString()}</span> },
  { key: "embedding", header: "Embedding model", render: (r) => <span className="text-[12px] text-[var(--text-secondary)] font-mono-tabular">{r.embedding}</span> },
  { key: "lastWrite", header: "Last write", render: (r) => <span className="text-[12px] text-[var(--text-muted)]">{r.lastWrite}</span> },
];

export const Route = createFileRoute("/memory")({
  head: () => ({ meta: [{ title: "Memory — Harness" }] }),
  component: () => (
    <>
      <PageHeader title="Memory" subtitle="Long-term vector stores powering agent recall" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{s.label}</div>
            <div className="mt-1 text-[22px] font-semibold font-mono-tabular">{s.value}</div>
          </div>
        ))}
      </div>
      <DataTable columns={cols} rows={ns} />
    </>
  ),
});
