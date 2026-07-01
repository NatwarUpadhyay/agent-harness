import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { seedIfEmpty } from "@/lib/data/seed";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
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
