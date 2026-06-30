import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  display?: (v: number) => string;
  trend: number;
  trendTone?: "green" | "amber" | "red";
  series: number[];
  index?: number;
}

export function MetricCard({ label, value, display, trend, trendTone = "green", series, index = 0 }: Props) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (latest) => (display ? display(latest) : Math.round(latest).toLocaleString()));
  const [text, setText] = useState(display ? display(0) : "0");

  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.2, ease: [0.16, 1, 0.32, 1] });
    const unsub = rounded.on("change", (v) => setText(String(v)));
    return () => { controls.stop(); unsub(); };
  }, [value, mv, rounded]);

  const data = series.map((y, x) => ({ x, y }));
  const positive = trend >= 0;
  const toneColor =
    trendTone === "amber" ? "text-[var(--warning)]" :
    trendTone === "red"   ? "text-[var(--danger)]"  :
                            "text-[var(--success)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.32, 1] }}
      className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 hover:border-[var(--border-strong)] transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
        <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium", toneColor)}>
          {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(trend)}%
        </span>
      </div>
      <motion.div className="text-[28px] font-semibold font-mono-tabular tracking-tight leading-none">
        {text}
      </motion.div>
      <div className="mt-3 h-[36px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="y" stroke="var(--accent)" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
