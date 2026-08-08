import { createFileRoute, Outlet } from "@tanstack/react-router";

const SCIM_CONTENT_TYPE = "application/scim+json";

export function scimResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": SCIM_CONTENT_TYPE,
    },
  });
}

export const Route = createFileRoute("/api/public/scim/v2")({
  component: () => <Outlet />,
  server: {
    handlers: {
      GET: async () => {
        return scimResponse({
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
          patch: { supported: true },
          bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
          filter: { supported: false, maxResults: 0 },
          changePassword: { supported: false },
          sort: { supported: false },
          etag: { supported: false },
          authenticationSchemes: [
            {
              type: "oauthbearertoken",
              name: "OAuth Bearer Token",
              description: "SCIM token is stored in the Harness Enterprise Auth config.",
              specUri: "https://tools.ietf.org/html/rfc6750",
              primary: true,
            },
          ],
          meta: {
            resourceType: "ServiceProviderConfig",
            location: "/api/public/scim/v2/ServiceProviderConfig",
          },
        });
      },
    },
  },
});
