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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<{ name?: string | null; email?: string | null } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted || !data.user) return;
      const meta = (data.user.user_metadata ?? {}) as { full_name?: string; name?: string };
      setUser({ name: meta.full_name || meta.name || null, email: data.user.email });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!session?.user) { setUser(null); return; }
      const meta = (session.user.user_metadata ?? {}) as { full_name?: string; name?: string };
      setUser({ name: meta.full_name || meta.name || null, email: session.user.email });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const initials = initialsFrom(user?.name, user?.email);
  const displayName = user?.name || (user?.email ? user.email.split("@")[0] : "Guest");

  const handleSignOut = async () => {
    setMenuOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

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
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={`Account: ${displayName}`}
              title={displayName}
              className="grid h-8 w-8 place-items-center rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[11px] font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
            >
              {initials}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg overflow-hidden z-40">
                <div className="px-3 py-2.5 border-b border-[var(--border-subtle)]">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{displayName}</div>
                  {user?.email && (
                    <div className="text-[11px] text-[var(--text-muted)] truncate">{user.email}</div>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
