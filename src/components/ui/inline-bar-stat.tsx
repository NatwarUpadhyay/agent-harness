import { motion } from "framer-motion";

export function InlineBarStat({ label, value, max = 100 }: { label?: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1 text-[11px] text-[var(--text-secondary)]">
          <span>{label}</span>
          <span className="font-mono-tabular text-[var(--text-primary)]">{value.toFixed(1)}%</span>
        </div>
      )}
      <div className="h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.32, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--violet)]"
        />
      </div>
    </div>
  );
}
