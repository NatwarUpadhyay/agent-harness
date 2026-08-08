import { createFileRoute } from "@tanstack/react-router";
import { handleGetUser, handleUpdateUser, handlePatchUser, handleDeleteUser } from "@/lib/scim.server";

export const Route = createFileRoute("/api/public/scim/v2/Users/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handleGetUser(request, params.id),
      PUT: async ({ request, params }) => handleUpdateUser(request, params.id),
      PATCH: async ({ request, params }) => handlePatchUser(request, params.id),
      DELETE: async ({ request, params }) => handleDeleteUser(request, params.id),
    },
  },
});
