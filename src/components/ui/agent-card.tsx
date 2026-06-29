import { motion } from "framer-motion";
import { StatusDot } from "./status-badge";
import { InlineBarStat } from "./inline-bar-stat";
import { relativeTime } from "@/lib/data/synthetic";
import type { Agent } from "@/types";

const modelColors: Record<Agent["model"], string> = {
  "gpt-4o": "text-[var(--text-accent)] bg-[var(--accent-muted)]",
  "claude-3-5-sonnet": "text-[var(--violet)] bg-[color:rgb(139_92_246_/_0.12)]",
  "gemini-1.5-pro": "text-[var(--teal)] bg-[color:rgb(20_184_166_/_0.12)]",
};

export function AgentCard({ agent, index = 0 }: { agent: Agent; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.16, 1, 0.32, 1] }}
      whileHover={{ y: -2 }}
      className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)] transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusDot status={agent.status} />
          <span className="font-semibold text-[14px]">{agent.name}</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono-tabular ${modelColors[agent.model]}`}>
          {agent.model}
        </span>
      </div>
      <InlineBarStat label="Success" value={agent.successRate} />
      <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono-tabular">
        <span>{agent.totalCalls.toLocaleString()} calls</span>
        <span>{agent.avgLatency}ms · {relativeTime(agent.lastActive)}</span>
      </div>
    </motion.div>
  );
}
