import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "@/components/ui/command-palette";
import { ShortcutOverlay } from "@/components/ui/shortcut-overlay";
import { useUiStore } from "@/stores/ui";
import { Toaster } from "@/components/ui/sonner";

export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const commandOpen = useUiStore((s) => s.commandOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const isEditable = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (e.key === "?" && !commandOpen && !isEditable(e.target)) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen, commandOpen]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar />
      <div
        className="flex flex-col min-h-screen transition-[margin] duration-200 md:[margin-left:var(--shell-ml)]"
        style={{ ["--shell-ml" as string]: collapsed ? "64px" : "240px" }}
      >
        <Header />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 pt-6 pb-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.32, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <CommandPalette />
      <ShortcutOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
