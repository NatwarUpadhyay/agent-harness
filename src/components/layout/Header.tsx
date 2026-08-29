import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Search, Bell, ChevronRight, LogOut, CheckCheck, AlertTriangle, Activity, Rocket, Menu, Megaphone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUiStore } from "@/stores/ui";
import { allNavItems } from "./nav-config";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActivityEvents, markActivityRead, markAllActivityRead, type ActivityEvent, type ActivityKind } from "@/lib/data/activity.functions";

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

type NotificationKind = ActivityKind;

function kindIcon(kind: NotificationKind) {
  switch (kind) {
    case "budget_breach":
    case "slo_breach":
      return { Icon: AlertTriangle, color: "var(--danger)" };
    case "remediation_applied":
    case "success":
      return { Icon: CheckCheck, color: "var(--success)" };
    case "alert_escalated":
    case "warning":
      return { Icon: AlertTriangle, color: "var(--warning)" };
    case "run_completed":
    case "info":
      return { Icon: Activity, color: "var(--teal)" };
    case "deploy":
      return { Icon: Rocket, color: "var(--accent)" };
    default:
      return { Icon: Megaphone, color: "var(--accent)" };
  }
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NotificationIcon({ kind }: { kind: NotificationKind }) {
  const { Icon, color } = kindIcon(kind);
  return (
    <div
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
      style={{ background: "var(--bg-elevated)", color }}
    >
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}

export function Header() {
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const crumbs = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<{ name?: string | null; email?: string | null } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchActivity = useServerFn(listActivityEvents);
  const readOne = useServerFn(markActivityRead);
  const readAll = useServerFn(markAllActivityRead);

  const { data: notifications = [] } = useQuery({
    queryKey: ["activity_events"],
    queryFn: () => fetchActivity(),
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => readOne({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activity_events"] }),
  });

  const readAllMutation = useMutation({
    mutationFn: () => readAll(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activity_events"] }),
  });

  const unread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

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
    if (!menuOpen && !notifOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenuOpen(false); setNotifOpen(false); }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, notifOpen]);

  const initials = initialsFrom(user?.name, user?.email);
  const displayName = user?.name || (user?.email ? user.email.split("@")[0] : "Guest");

  const handleSignOut = async () => {
    setMenuOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const markAllRead = () => {
    if (unread > 0) readAllMutation.mutate();
  };
  const markRead = (id: string) => readMutation.mutate(id);

  return (
    <header className="sticky top-0 z-30 h-14 bg-[var(--bg-base)]/85 backdrop-blur border-b border-[var(--border-subtle)]">
      <div className="h-full flex items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={toggleSidebar}
            className="md:hidden grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
          <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
            {crumbs.slice(-2).map((c, i, arr) => (
              <div key={c.to} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />}
                <Link
                  to={c.to}
                  className={
                    i === arr.length - 1
                      ? "text-[var(--text-primary)] font-medium capitalize truncate"
                      : "hidden sm:inline text-[var(--text-secondary)] hover:text-[var(--text-primary)] capitalize truncate"
                  }
                >
                  {c.label}
                </Link>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setCommandOpen(true)}
            className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-md border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
            aria-label="Open search"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="font-mono-tabular text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)]">⌘K</kbd>
          </button>
          <button
            onClick={() => setCommandOpen(true)}
            className="sm:hidden grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Open search"
          >
            <Search className="h-4 w-4" />
          </button>

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen((v) => !v); setMenuOpen(false); }}
              aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
              aria-expanded={notifOpen}
              className="relative grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-[var(--accent)] text-[9px] font-semibold text-[var(--bg-base)] grid place-items-center font-mono-tabular">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-[min(360px,calc(100vw-2rem))] rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg overflow-hidden z-40">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)]">
                  <div className="text-[13px] font-medium">Notifications</div>
                  <button
                    onClick={markAllRead}
                    disabled={unread === 0 || readAllMutation.isPending}
                    className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-8 text-center text-[12px] text-[var(--text-muted)]">
                      You're all caught up.
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-elevated)] transition-colors"
                      >
                        <NotificationIcon kind={n.kind} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-[12.5px] font-medium text-[var(--text-primary)] truncate">{n.title}</div>
                            {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />}
                          </div>
                          <div className="text-[11.5px] text-[var(--text-secondary)] line-clamp-2 mt-0.5">{n.body}</div>
                          <div className="text-[10.5px] text-[var(--text-muted)] font-mono-tabular mt-1">{formatRelative(n.created_at)}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <Link
                  to="/activity"
                  onClick={() => setNotifOpen(false)}
                  className="block w-full px-3 py-2 text-center text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-t border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]"
                >
                  View all activity
                </Link>
              </div>
            )}
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => { setMenuOpen((v) => !v); setNotifOpen(false); }}
              aria-label={`Account: ${displayName}`}
              aria-expanded={menuOpen}
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
