import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Hexagon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Harness — Enterprise AI control plane" },
      { name: "description", content: "Run, observe and govern AI agents across your organization." },
      { property: "og:title", content: "Harness — Enterprise AI control plane" },
      { property: "og:description", content: "Run, observe and govern AI agents across your organization." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();

  // Redirect after mount (not in beforeLoad) so the server-rendered splash
  // matches the client's first render — a beforeLoad redirect during hydration
  // produced a hydration mismatch that blanked the screen in production.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else navigate({ to: "/login", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] flex items-center justify-center">
      <div className="flex items-center gap-2.5 text-[var(--text-muted)]">
        <Hexagon className="h-5 w-5 animate-pulse" strokeWidth={2.2} />
        <span className="text-[13px]">Loading Harness…</span>
      </div>
    </div>
  );
}
