import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/triggers/$token")({
  component: () => <Outlet />,
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = String(params.token ?? "");
        if (!/^[a-f0-9]{32}$/.test(token)) {
          return Response.json({ error: "Invalid trigger token" }, { status: 401 });
        }

        let input: string | undefined;
        try {
          const body = (await request.json()) as { input?: unknown };
          if (typeof body?.input === "string") input = body.input.slice(0, 4000);
        } catch {
          // body is optional
        }

        const { runByWebhookToken } = await import("@/lib/data/scheduler.server");
        const outcome = await runByWebhookToken(token, input);
        if (!outcome) {
          return Response.json({ error: "Trigger not found or disabled" }, { status: 404 });
        }
        return Response.json(outcome, { status: outcome.status === "succeeded" ? 200 : 502 });
      },
    },
  },
});
