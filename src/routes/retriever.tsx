import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/retriever")({
  head: () => ({ meta: [{ title: "Retriever — Harness" }] }),
  component: () => (
    <>
      <PageHeader title="Retriever" subtitle="Configure how agents find the right context, fast" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-6">
          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-2">Retrieval strategy</label>
            <div className="grid grid-cols-3 gap-2">
              {["Dense", "Hybrid (BM25 + dense)", "Reranked"].map((s, i) => (
                <button key={s} className={`h-9 rounded-md text-[13px] border ${i === 1 ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--text-accent)]" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`}>{s}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] uppercase tracking-wider text-[var(--text-muted)]">Top-k</label>
              <span className="text-[13px] font-mono-tabular">8</span>
            </div>
            <input type="range" min={1} max={32} defaultValue={8} className="w-full accent-[var(--accent)]" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] uppercase tracking-wider text-[var(--text-muted)]">Similarity threshold</label>
              <span className="text-[13px] font-mono-tabular">0.72</span>
            </div>
            <input type="range" min={0} max={100} defaultValue={72} className="w-full accent-[var(--accent)]" />
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-2">Reranker</label>
            <select disabled className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 text-[13px] text-[var(--text-secondary)]">
              <option>cohere-rerank-3</option>
            </select>
          </div>
        </div>

        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Live metrics" />
          <ul className="space-y-3">
            {[
              ["Recall @10", "92.7%"],
              ["Precision @10", "81.4%"],
              ["Avg latency", "118ms"],
              ["Cache hit rate", "64.0%"],
              ["Rerank lift", "+11.2%"],
            ].map(([k, v]) => (
              <li key={k} className="flex items-center justify-between text-[13px]">
                <span className="text-[var(--text-secondary)]">{k}</span>
                <span className="font-mono-tabular">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  ),
});
