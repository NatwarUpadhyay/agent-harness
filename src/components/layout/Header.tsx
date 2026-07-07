import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Search, Bell, ChevronRight, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/stores/ui";
import { allNavItems } from "./nav-config";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

function initialsFrom(name: string | null | undefined, email: string | null | undefined) {
  const src = (name && name.trim()) || (email ? email.split("@")[0] : "");
  if (!src) return "?";
  const parts = src.replace(/[._-]+/g, " ").split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : src.slice(0, 2);
  return letters.toUpperCase();
}

function useBreadcrumbs() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  if (pathname === "/") return [{ label: "Dashboard", to: "/" }];
  const segs = pathname.split("/").filter(Boolean);
  const crumbs = [{ label: "Home", to: "/" }];
  let path = "";
  segs.forEach((s) => {
    path += "/" + s;
    const match = allNavItems.find((n) => n.to === path);
    crumbs.push({ label: match?.label ?? s.replace(/-/g, " "), to: path });
  });
  return crumbs;
}

export function Header() {
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const crumbs = useBreadcrumbs();

  return (
    <header className="sticky top-0 z-30 h-14 bg-[var(--bg-base)]/85 backdrop-blur border-b border-[var(--border-subtle)]">
      <div className="h-full flex items-center justify-between px-6">
        <nav className="flex items-center gap-1.5 text-[13px]">
          {crumbs.slice(-2).map((c, i, arr) => (
            <div key={c.to} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
              <Link
                to={c.to}
                className={
                  i === arr.length - 1
                    ? "text-[var(--text-primary)] font-medium capitalize"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] capitalize"
                }
              >
                {c.label}
              </Link>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-md border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="font-mono-tabular text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)]">⌘K</kbd>
          </button>
          <button className="relative grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          </button>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[11px] font-semibold text-[var(--text-primary)]">
            AK
          </div>
        </div>
      </div>
    </header>
  );
}
