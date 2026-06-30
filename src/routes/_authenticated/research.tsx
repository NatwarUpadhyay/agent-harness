import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { motion } from "framer-motion";

const papers = [
  { id: "r1", title: "Reflexion: Language Agents with Verbal Reinforcement Learning", source: "arXiv",     date: "2024-03-12", abstract: "Agents that reflect on their own outputs improve task success without weight updates. A small verbal critic and episodic memory yield gains across coding and decision-making benchmarks." },
  { id: "r2", title: "Toolformer: Self-Taught Tool Use",                              source: "arXiv",     date: "2023-11-28", abstract: "Language models can learn to invoke APIs by sampling, executing, and filtering tool calls during pretraining — no human labels required." },
  { id: "r3", title: "Constitutional AI: Harmlessness from AI Feedback",              source: "arXiv",     date: "2022-12-15", abstract: "Replacing human red-teaming with a critique-and-revise loop guided by a written constitution scales safety training cheaply." },
  { id: "r4", title: "ReAct: Synergizing Reasoning and Acting",                       source: "arXiv",     date: "2023-03-10", abstract: "Interleaving thought and action traces improves multi-step problem solving by grounding reasoning in tool observations." },
  { id: "r5", title: "Harness internal benchmark results — Q2",                       source: "Internal",  date: "2025-06-20", abstract: "Across 14 evaluation suites, the new planner prompt lifted aggregate pass rate from 84.1% to 92.7% while cutting median latency by 18%." },
  { id: "r6", title: "MCP: A protocol for tool-augmented agents",                     source: "Anthropic", date: "2024-11-01", abstract: "Model Context Protocol defines a single transport for exposing tools, resources, and prompts to any compliant agent runtime." },
];

const sourceColor: Record<string, string> = {
  arXiv: "var(--accent)", Internal: "var(--violet)", Anthropic: "var(--amber)",
};

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({ meta: [{ title: "Research — Harness" }] }),
  component: () => (
    <>
      <PageHeader title="Research" subtitle="Curated literature shaping the platform's agent runtime" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {papers.map((p, i) => (
          <motion.article
            key={p.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 hover:border-[var(--border-strong)]"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-medium" style={{ background: `color-mix(in oklab, ${sourceColor[p.source]} 14%, transparent)`, color: sourceColor[p.source] }}>
                {p.source}
              </span>
              <span className="text-[10px] font-mono-tabular text-[var(--text-muted)]">{p.date}</span>
            </div>
            <h3 className="text-[14px] font-semibold leading-snug mb-2">{p.title}</h3>
            <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">{p.abstract}</p>
          </motion.article>
        ))}
      </div>
    </>
  ),
});
