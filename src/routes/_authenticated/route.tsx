import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { seedIfEmpty } from "@/lib/data/seed";

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
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    // Fire-and-forget seed (idempotent). Doesn't block navigation.
    seedIfEmpty(data.user.id).catch(() => {});
    return { user: data.user };
  },
  component: () => <Outlet />,
});
