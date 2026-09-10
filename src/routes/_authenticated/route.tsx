import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { seedDemoData } from "@/lib/data/seed.functions";
import { acceptPendingInvitations } from "@/lib/data/team.functions";
import { ensureOwnerRole } from "@/lib/data/rbac.functions";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // If Supabase redirected a password-recovery link into a protected route,
    // forward the hash to /reset-password before the auth gate strips it.
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("type=recovery")) {
        window.location.replace(`/reset-password${hash}`);
        throw redirect({ to: "/reset-password" });
      }
    }
    // A network hiccup makes getUser() reject (e.g. "Failed to fetch"). Let that
    // escape and the protected shell renders nothing at all — treat it the same
    // as "not signed in" and send the visitor to the login screen instead.
    let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error) user = data.user;
    } catch {
      user = null;
    }
    if (!user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    // Fire-and-forget seed (idempotent). Doesn't block navigation.
    seedDemoData().catch(() => {});
    // Ensure the authenticated user has an owner governance role for their workspace.
    ensureOwnerRole().catch(() => {});
    // Auto-accept any pending team invitations for this user.
    acceptPendingInvitations().catch(() => {});
    return { user };
  },
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">We couldn't load your workspace</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          The connection dropped while signing you in. Reload to try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-base)]"
        >
          Reload
        </button>
      </div>
    </div>
  ),
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
