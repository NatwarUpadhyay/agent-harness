import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Hexagon, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { provisionPlanFromCheckout } from "@/lib/data/checkout.functions";

const searchSchema = z.object({
  session_id: z.string().optional(),
});

export const Route = createFileRoute("/checkout/success")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Checkout success — Harness" },
      { name: "description", content: "Your Harness plan has been activated." },
    ],
  }),
  component: CheckoutSuccessPage,
});

function CheckoutSuccessPage() {
  const search = useSearch({ from: "/checkout/success" });
  const sessionId = search.session_id;
  const provision = useServerFn(provisionPlanFromCheckout);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!sessionId) {
      setState("error");
      setMessage("No checkout session was returned.");
      return;
    }
    provision({ data: { sessionId } })
      .then(() => setState("success"))
      .catch((err: unknown) => {
        setState("error");
        setMessage(err instanceof Error ? err.message : "Could not activate your plan.");
      });
  }, [sessionId, provision]);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 text-[var(--text-primary)] mb-8">
          <Hexagon className="h-5 w-5 text-[var(--accent)]" />
          <span className="text-[15px] font-semibold tracking-tight">Harness</span>
        </Link>

        <div className="rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-8">
          {state === "loading" && (
            <>
              <Loader2 className="h-10 w-10 text-[var(--accent)] animate-spin mx-auto mb-4" />
              <h1 className="text-[20px] font-medium">Activating your plan…</h1>
              <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
                We're confirming your checkout and updating your entitlements.
              </p>
            </>
          )}
          {state === "success" && (
            <>
              <CheckCircle2 className="h-10 w-10 text-[var(--success)] mx-auto mb-4" />
              <h1 className="text-[20px] font-medium">Welcome to your new plan</h1>
              <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
                Your entitlements are active. Head to Settings to invite your team.
              </p>
              <div className="mt-6">
                <Link
                  to="/settings"
                  className="inline-flex items-center justify-center h-10 px-5 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
                >
                  Go to Settings
                </Link>
              </div>
            </>
          )}
          {state === "error" && (
            <>
              <AlertCircle className="h-10 w-10 text-[var(--danger)] mx-auto mb-4" />
              <h1 className="text-[20px] font-medium">We couldn't activate your plan</h1>
              <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{message}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center h-10 px-5 rounded-md border border-[var(--border-strong)] text-[13px] font-medium hover:bg-[var(--bg-elevated)]"
                >
                  Back to pricing
                </Link>
                <a
                  href="mailto:support@harness.dev"
                  className="inline-flex items-center justify-center h-10 px-5 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
                >
                  Contact support
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
