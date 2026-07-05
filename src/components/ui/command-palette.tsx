import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bot, Wrench, Workflow, Beaker, ArrowRight, Clock } from "lucide-react";
import { useUiStore } from "@/stores/ui";
import { navGroups } from "@/components/layout/nav-config";
import { useAgents, useTools, useWorkflows, useExperiments } from "@/lib/hooks/use-entities";

type Item = {
  id: string;
  label: string;
  group: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
};

const RECENTS_KEY = "harness-cmdk-recents";

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function pushRecent(id: string) {
  if (typeof window === "undefined") return;
  const cur = loadRecents().filter((x) => x !== id);
  cur.unshift(id);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(cur.slice(0, 6)));
}

function fuzzyIncludes(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let i = 0;
  for (const ch of n) {
    const idx = h.indexOf(ch, i);
    if (idx === -1) return false;
    i = idx + 1;
  }
  return true;
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);

  const { data: agents = [] } = useAgents();
  const { data: tools = [] } = useTools();
  const { data: workflows = [] } = useWorkflows();
  const { data: experiments = [] } = useExperiments();

  useEffect(() => { setQuery(""); setCursor(0); if (open) setRecents(loadRecents()); }, [open]);

  const items = useMemo<Item[]>(() => {
    const navItems: Item[] = navGroups.flatMap((g) =>
      g.items.map((i) => ({
        id: `nav-${i.to}`, label: i.label, group: `Go to · ${g.label}`,
        to: i.to, icon: i.icon,
      })),
    );
    const agentItems: Item[] = agents.map((a) => ({
      id: `agent-${a.id}`, label: a.name, group: "Agents", to: "/agents",
      icon: Bot, hint: a.model,
    }));
    const toolItems: Item[] = tools.map((t) => ({
      id: `tool-${t.id}`, label: t.name, group: "Tools", to: "/tools",
      icon: Wrench, hint: t.category,
    }));
    const wfItems: Item[] = workflows.map((w) => ({
      id: `wf-${w.id}`, label: w.name, group: "Workflows", to: "/harness",
      icon: Workflow,
    }));
    const expItems: Item[] = experiments.map((e) => ({
      id: `exp-${e.id}`, label: e.name, group: "Experiments", to: "/experiments",
      icon: Beaker, hint: e.status,
    }));
    return [...navItems, ...agentItems, ...toolItems, ...wfItems, ...expItems];
  }, [agents, tools, workflows, experiments]);

  const recentItems = useMemo(
    () => recents.map((id) => items.find((i) => i.id === id)).filter(Boolean) as Item[],
    [recents, items],
  );

  const filtered = useMemo(() => {
    if (!query) return recentItems;
    return items.filter((i) => fuzzyIncludes(i.label, query)).slice(0, 40);
  }, [items, query, recentItems]);

  const grouped = useMemo(() => {
    if (!query) return recentItems.length ? [["Recent", recentItems] as [string, Item[]]] : [];
    const map = new Map<string, Item[]>();
    filtered.forEach((i) => {
      if (!map.has(i.group)) map.set(i.group, []);
      map.get(i.group)!.push(i);
    });
    return Array.from(map.entries());
  }, [filtered, recentItems, query]);

  const flat = filtered;

  const activate = (item: Item) => {
    pushRecent(item.id);
    navigate({ to: item.to });
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(flat.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter") {
      const item = flat[cursor];
      if (item) activate(item);
    } else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 grid place-items-start pt-[18vh] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl mx-auto rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 h-12 border-b border-[var(--border-subtle)]">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
              <input
                autoFocus value={query}
                onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
                onKeyDown={onKeyDown}
                placeholder="Search pages, agents, tools, workflows…"
                className="flex-1 bg-transparent text-[14px] placeholder:text-[var(--text-muted)] outline-none"
              />
              <kbd className="font-mono-tabular text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                esc
              </kbd>
            </div>
            <div className="max-h-[420px] overflow-y-auto py-2">
              {flat.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
                  {query ? "No results" : "Start typing to search, or press ? for shortcuts"}
                </div>
              )}
              {grouped.map(([group, list]) => (
                <div key={group} className="mb-2">
                  <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    {group === "Recent" && <Clock className="h-3 w-3" />}
                    {group}
                  </div>
                  {list.map((i) => {
                    const active = flat.indexOf(i) === cursor;
                    const Icon = i.icon;
                    return (
                      <Link
                        key={i.id} to={i.to}
                        onClick={(e) => { e.preventDefault(); activate(i); }}
                        onMouseEnter={() => setCursor(flat.indexOf(i))}
                        className={`flex items-center gap-3 px-4 py-2 text-[13px] transition-colors ${
                          active ? "bg-[var(--accent-muted)] text-[var(--text-primary)]" : "hover:bg-[var(--accent-muted)]/60"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-[var(--text-muted)]" />
                        <span className="flex-1 truncate">{i.label}</span>
                        {i.hint && (
                          <span className="text-[10px] font-mono-tabular text-[var(--text-muted)]">{i.hint}</span>
                        )}
                        <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-4 h-9 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)]">
              <span>{flat.length} {query ? "results" : "recent"}</span>
              <span className="flex items-center gap-2">
                <kbd className="font-mono-tabular px-1 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">↑↓</kbd> navigate
                <kbd className="font-mono-tabular px-1 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">↵</kbd> open
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
