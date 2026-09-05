import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Hexagon, Check, Loader2, ArrowRight, Sparkles, Zap, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getBillingPlan, type BillingPlan } from "@/lib/data/billing.functions";
import { createCheckoutSession } from "@/lib/data/checkout.functions";

const searchSchema = z.object({
  mode: z.enum(["signup", "signin"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/pricing")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Pricing — Harness" },
      { name: "description", content: "Simple, transparent pricing for teams building with AI agents." },
      { property: "og:title", content: "Pricing — Harness" },
      { property: "og:description", content: "Simple, transparent pricing for teams building with AI agents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

const plans: Array<{
  name: BillingPlan["name"];
  price_usd: number;
  billing_interval: BillingPlan["billing_interval"];
  description: string;
  features: string[];
  cta: string;
  icon: typeof Sparkles;
  highlight?: boolean;
}> = [
  {
    name: "Starter",
    price_usd: 0,
    billing_interval: "monthly",
    description: "For individuals exploring agent flows.",
    features: ["Canvas", "Simulate", "Usage analytics", "5 saved workflows", "Community support"],
    cta: "Get started free",
    icon: Zap,
  },
  {
    name: "Team",
    price_usd: 49,
    billing_interval: "monthly",
    description: "For teams shipping agentic products together.",
    features: ["Everything in Starter", "Up to 10 seats", "Shared workflows", "Scoped API keys", "Audit log", "Priority support"],
    cta: "Start free trial",
    icon: Sparkles,
    highlight: true,
  },
  {
    name: "Enterprise",
    price_usd: 299,
    billing_interval: "monthly",
    description: "For companies that need governance at scale.",
    features: ["Everything in Team", "Up to 100 seats", "SSO / SCIM", "SLOs & remediation", "Custom contracts", "Dedicated success"],
    cta: "Contact sales",
    icon: Shield,
  },
];

function PricingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [session, setSession] = useState<unknown>(null);
  const [authChecked, setAuthChecked] = useState(false);

  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session);
    setAuthChecked(true);
  });

  const fetchPlan = useServerFn(getBillingPlan);
  const doCheckout = useServerFn(createCheckoutSession);

  const planQuery = useQuery({
    queryKey: ["billing-plan"],
    queryFn: () => fetchPlan(),
    enabled: !!session,
  });

  const checkout = useMutation({
    mutationFn: async ({ name, interval }: { name: BillingPlan["name"]; interval: BillingPlan["billing_interval"] }) => {
      return doCheckout({ data: { planName: name, billingInterval: interval } });
    },
    onSuccess: (res) => {
      if (res.mode === "stripe" && res.url) {
        window.location.assign(res.url);
      } else if (res.mode === "free-upgraded") {
        qc.invalidateQueries({ queryKey: ["billing-plan"] });
        toast.success(`You're now on the ${res.plan} plan.`);
        navigate({ to: "/settings" });
      } else {
        toast("Thanks — our team will reach out to complete your upgrade.");
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Checkout failed"),
  });

  const currentPlanName = planQuery.data?.name;

  const handleCta = (plan: (typeof plans)[number]) => {
    if (!session) {
      navigate({ to: "/login", search: { mode: "signup", redirect: "/pricing" } as never });
      return;
    }
    if (plan.name === currentPlanName) {
      navigate({ to: "/settings" });
      return;
    }
    checkout.mutate({ name: plan.name, interval: plan.billing_interval });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <header className="border-b border-[var(--border-default)] bg-[var(--bg-base)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-[var(--text-primary)]">
            <Hexagon className="h-5 w-5 text-[var(--accent)]" />
            <span className="text-[15px] font-semibold tracking-tight">Harness</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Sign in
            </Link>
            <Link
              to="/login"
              search={{ mode: "signup" } as never}
              className="h-8 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[12px] font-medium hover:bg-[var(--accent-hover)] flex items-center gap-1"
            >
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-[36px] md:text-[48px] font-semibold tracking-tight leading-tight">
            Simple pricing for agent teams
          </h1>
          <p className="mt-4 text-[16px] text-[var(--text-secondary)]">
            Start free, upgrade when you're ready to share workflows with your team. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const active = currentPlanName === plan.name;
            const isLoading = checkout.isPending && checkout.variables?.name === plan.name;
            return (
              <div
                key={plan.name}
                className={`relative rounded-[14px] border p-6 md:p-8 flex flex-col transition-all ${
                  plan.highlight
                    ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                    : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[var(--accent)] text-[var(--bg-base)] text-[11px] font-medium">
                    Most popular
                  </div>
                )}
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
                    <Icon className="h-4 w-4 text-[var(--accent)]" />
                  </div>
                  <h2 className="text-[18px] font-medium">{plan.name}</h2>
                </div>
                <div className="mb-1">
                  <span className="text-[40px] font-mono-tabular font-medium">${plan.price_usd}</span>
                  <span className="text-[var(--text-secondary)] text-[14px]">/month</span>
                </div>
                <p className="text-[13px] text-[var(--text-secondary)] mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-[var(--text-secondary)]">
                      <Check className="h-4 w-4 text-[var(--success)] shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCta(plan)}
                  disabled={isLoading || !authChecked}
                  className={`w-full h-10 rounded-md text-[13px] font-medium flex items-center justify-center gap-2 transition-colors ${
                    plan.highlight
                      ? "bg-[var(--accent)] text-[var(--bg-base)] hover:bg-[var(--accent-hover)]"
                      : "border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                  } disabled:opacity-60`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                    </>
                  ) : active ? (
                    "Current plan"
                  ) : (
                    plan.cta
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-16 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-[22px] font-medium">Need a custom deployment?</h2>
            <p className="mt-2 text-[14px] text-[var(--text-secondary)] max-w-xl">
              Bring your own cloud, VPC, or compliance requirements. We offer annual contracts, custom seat counts, and dedicated infrastructure.
            </p>
          </div>
          <a
            href="mailto:sales@harness.dev"
            className="h-10 px-5 rounded-md border border-[var(--border-strong)] text-[13px] font-medium hover:bg-[var(--bg-elevated)] flex items-center gap-2 whitespace-nowrap"
          >
            Contact sales <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </main>
    </div>
  );
}
