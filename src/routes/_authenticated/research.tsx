import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, ExternalLink, Bookmark, BookmarkCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";

const papers = [
  { id: "r1", title: "Reflexion: Language Agents with Verbal Reinforcement Learning", source: "arXiv",     date: "2024-03-12", abstract: "Agents that reflect on their own outputs improve task success without weight updates. A small verbal critic and episodic memory yield gains across coding and decision-making benchmarks.", url: "https://arxiv.org/abs/2303.11366" },
  { id: "r2", title: "Toolformer: Self-Taught Tool Use",                              source: "arXiv",     date: "2023-11-28", abstract: "Language models can learn to invoke APIs by sampling, executing, and filtering tool calls during pretraining — no human labels required.", url: "https://arxiv.org/abs/2302.04761" },
  { id: "r3", title: "Constitutional AI: Harmlessness from AI Feedback",              source: "arXiv",     date: "2022-12-15", abstract: "Replacing human red-teaming with a critique-and-revise loop guided by a written constitution scales safety training cheaply.", url: "https://arxiv.org/abs/2212.08073" },
  { id: "r4", title: "ReAct: Synergizing Reasoning and Acting",                       source: "arXiv",     date: "2023-03-10", abstract: "Interleaving thought and action traces improves multi-step problem solving by grounding reasoning in tool observations.", url: "https://arxiv.org/abs/2210.03629" },
  { id: "r5", title: "Harness internal benchmark results — Q2",                       source: "Internal",  date: "2025-06-20", abstract: "Across 14 evaluation suites, the new planner prompt lifted aggregate pass rate from 84.1% to 92.7% while cutting median latency by 18%.", url: "#" },
  { id: "r6", title: "MCP: A protocol for tool-augmented agents",                     source: "Anthropic", date: "2024-11-01", abstract: "Model Context Protocol defines a single transport for exposing tools, resources, and prompts to any compliant agent runtime.", url: "https://modelcontextprotocol.io" },
];

const sourceColor: Record<string, string> = {
  arXiv: "var(--accent)", Internal: "var(--violet)", Anthropic: "var(--amber)",
};
const sources = ["all", "arXiv", "Internal", "Anthropic"] as const;
type SourceFilter = (typeof sources)[number];

const BOOK_KEY = "harness.research.bookmarks";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({ meta: [{ title: "Research — Harness" }] }),
  component: ResearchView,
});

function ResearchView() {
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<SourceFilter>("all");
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(BOOK_KEY) || "[]")); } catch { return new Set(); }
  });

  const toggleBookmark = (id: string, title: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast(`Removed bookmark`); }
      else { next.add(id); toast.success(`Bookmarked “${title}”`); }
      try { localStorage.setItem(BOOK_KEY, JSON.stringify([...next])); } catch { /* */ }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return papers.filter((p) => {
      if (src !== "all" && p.source !== src) return false;
      if (!term) return true;
      return p.title.toLowerCase().includes(term) || p.abstract.toLowerCase().includes(term);
    });
  }, [q, src]);

  return (
    <>
      <PageHeader title="Research" subtitle="Curated literature shaping the platform's agent runtime" />

      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles and abstracts…"
            className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] pl-8 pr-3 text-[13px]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <button
              key={s}
              onClick={() => setSrc(s)}
              className={`h-9 px-3 rounded-md text-[12px] border capitalize ${
                src === s
                  ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--text-accent)]"
                  : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[var(--border-default)] p-12 text-center text-[13px] text-[var(--text-secondary)]">
          No papers match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p, i) => {
            const bm = bookmarks.has(p.id);
            return (
              <motion.article
                key={p.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 hover:border-[var(--border-strong)] flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-medium" style={{ background: `color-mix(in oklab, ${sourceColor[p.source]} 14%, transparent)`, color: sourceColor[p.source] }}>
                    {p.source}
                  </span>
                  <span className="text-[10px] font-mono-tabular text-[var(--text-muted)]">{p.date}</span>
                </div>
                <h3 className="text-[14px] font-semibold leading-snug mb-2">{p.title}</h3>
                <p className="text-[12px] text-[var(--text-secondary)] line-clamp-3 leading-relaxed">{p.abstract}</p>
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-2">
                  <a
                    href={p.url}
                    target={p.url === "#" ? undefined : "_blank"}
                    rel="noreferrer"
                    onClick={(e) => { if (p.url === "#") { e.preventDefault(); toast("Internal document — open in DocHub"); } }}
                    className="inline-flex items-center gap-1 text-[12px] text-[var(--text-accent)] hover:underline"
                  >
                    Read <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    onClick={() => toggleBookmark(p.id, p.title)}
                    className="ml-auto inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {bm ? <BookmarkCheck className="h-3.5 w-3.5 text-[var(--text-accent)]" /> : <Bookmark className="h-3.5 w-3.5" />}
                    {bm ? "Saved" : "Save"}
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </>
  );
}
