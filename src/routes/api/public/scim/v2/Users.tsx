import { createFileRoute, Outlet } from "@tanstack/react-router";
import { handleListUsers, handleCreateUser } from "@/lib/scim.server";

export const Route = createFileRoute("/api/public/scim/v2/Users")({
  component: () => <Outlet />,
  server: {
    handlers: {
      GET: async ({ request }) => handleListUsers(request),
      POST: async ({ request }) => handleCreateUser(request),
    },
  },
});
