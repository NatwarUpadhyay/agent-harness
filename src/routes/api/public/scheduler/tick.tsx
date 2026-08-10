import { createFileRoute, Outlet } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

function authorized(request: Request): boolean {
  const secret = process.env["SCHEDULER_SECRET"];
  if (!secret) return false;
  const provided = request.headers.get("x-scheduler-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/scheduler/tick")({
  component: () => <Outlet />,
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { runDueSchedules } = await import("@/lib/data/scheduler.server");
        const outcomes = await runDueSchedules();
        return Response.json({ fired: outcomes.length, outcomes });
      },
    },
  },
});
