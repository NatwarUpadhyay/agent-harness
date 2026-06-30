import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Hexagon, ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { useUiStore } from "@/stores/ui";
import { navGroups } from "./nav-config";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle at 0% 100%, rgba(79,122,255,0.18), transparent 55%)",
      }}
    >
      {/* Logo + collapse */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-[var(--border-subtle)]">
        <Link to="/" className="flex items-center gap-2 overflow-hidden">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-[var(--accent-muted)] text-[var(--text-accent)] shrink-0">
            <Hexagon className="h-4 w-4" strokeWidth={2.2} />
          </div>
          {!collapsed && (
            <span className="font-semibold tracking-tight text-[15px]">Harness</span>
          )}
        </Link>
        <button
          onClick={toggle}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <div className="px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] font-medium">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.to);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-[var(--accent-muted)] text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--accent-muted)]/60 hover:text-[var(--text-primary)]",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[var(--accent)] transition-all duration-200",
                          active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                        )}
                      />
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-[var(--border-subtle)] px-3 py-3 flex items-center gap-2">
        <motion.div
          whileHover={{ scale: 1.04 }}
          className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--violet)] text-[12px] font-semibold text-white"
        >
          AK
        </motion.div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate">Avery Kim</div>
              <div className="text-[11px] text-[var(--text-muted)] truncate">Platform admin</div>
            </div>
            <SettingsIcon className="h-4 w-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" />
          </>
        )}
      </div>
    </aside>
  );
}
