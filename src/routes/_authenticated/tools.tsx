import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { tools } from "@/lib/data/synthetic";
import { InlineBarStat } from "@/components/ui/inline-bar-stat";
import { Wrench, Search, Database, ArrowLeftRight } from "lucide-react";
import { motion } from "framer-motion";

const iconFor = (cat: string) =>
  cat === "retrieval" ? Search : cat === "memory" ? Database : cat === "io" ? ArrowLeftRight : Wrench;

const catColor: Record<string, string> = {
  retrieval: "var(--accent)", execution: "var(--amber)", memory: "var(--violet)", io: "var(--teal)",
};

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({ meta: [{ title: "Tools — Harness" }] }),
  component: () => (
    <>
      <PageHeader title="Tools" subtitle="Registered capabilities your agents can invoke" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tools.map((t, i) => {
          const Icon = iconFor(t.category);
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-md" style={{ background: `color-mix(in oklab, ${catColor[t.category]} 16%, transparent)`, color: catColor[t.category] }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-[14px]">{t.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{t.category}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-[var(--text-muted)] font-mono-tabular">{t.callCount.toLocaleString()} calls</div>
              <div className="mt-2"><InlineBarStat label="Success" value={t.successRate} /></div>
            </motion.div>
          );
        })}
      </div>
    </>
  ),
});
