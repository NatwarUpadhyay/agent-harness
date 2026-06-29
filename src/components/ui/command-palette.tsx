import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { useUiStore } from "@/stores/ui";
import { navGroups } from "@/components/layout/nav-config";

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const [query, setQuery] = useState("");

  const filtered = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 grid place-items-start pt-[18vh] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl mx-auto rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 h-12 border-b border-[var(--border-subtle)]">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, agents, prompts…"
                className="flex-1 bg-transparent text-[14px] placeholder:text-[var(--text-muted)] outline-none"
              />
              <kbd className="font-mono-tabular text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                esc
              </kbd>
            </div>
            <div className="max-h-[420px] overflow-y-auto py-2">
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">No results</div>
              )}
              {filtered.map((g) => (
                <div key={g.label} className="mb-2">
                  <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{g.label}</div>
                  {g.items.map((i) => (
                    <Link
                      key={i.to}
                      to={i.to}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-[13px] hover:bg-[var(--accent-muted)] transition-colors"
                    >
                      <i.icon className="h-4 w-4 text-[var(--text-muted)]" />
                      <span>{i.label}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
