import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getBillingPlan,
  getUsageMeters,
  updateBillingPlan,
  type BillingPlan,
  type UsageMeter,
} from "@/lib/data/billing.functions";
import {
  getTeamRoster,
  inviteTeamMember,
  revokeInvitation,
  type TeamRoster,
} from "@/lib/data/team.functions";
import { formatMeterValue, planDisplayName } from "@/lib/data/billing";
import { CreditCard, Users, Zap, Coins, Activity, Check, X, Mail, Shield, User } from "lucide-react";

const tabs = ["General", "Team", "API keys", "Billing", "Integrations"] as const;
type Tab = (typeof tabs)[number];

const fieldsByTab: Record<Tab, Array<[string, string]>> = {
  General:       [["Organization name", "Acme AI"], ["Default region", "us-east-1"], ["Timezone", "America/New_York"]],
  Team:          [["Owner", "avery@acme.ai"], ["Seats used", "12 / 25"], ["SSO provider", "Okta"]],
  "API keys":    [["Public key", "pk_live_•••••••••••• 38af"], ["Last rotated", "2025-06-14"], ["Rate limit", "1000 req/min"]],
  Billing:       [],
  Integrations:  [["Slack", "Connected · #ai-ops"], ["PagerDuty", "Not connected"], ["Datadog", "Connected"]],
};

const PLAN_TIERS: Array<{
  name: string;
  price_usd: number;
  billing_interval: BillingPlan["billing_interval"];
  limits: BillingPlan["limits"];
  features: string[];
}> = [
  {
    name: "Starter",
    price_usd: 0,
    billing_interval: "monthly",
    limits: { seats: 1, runs_per_month: 100, tokens_per_month: 100_000, cost_usd_per_month: 100 },
    features: ["Canvas", "Simulate", "Usage analytics", "5 saved workflows"],
  },
  {
    name: "Team",
    price_usd: 49,
    billing_interval: "monthly",
    limits: { seats: 10, runs_per_month: 5_000, tokens_per_month: 5_000_000, cost_usd_per_month: 1_000 },
    features: ["Everything in Starter", "Team seats", "Shared workflows", "API keys"],
  },
  {
    name: "Enterprise",
    price_usd: 299,
    billing_interval: "monthly",
    limits: { seats: 100, runs_per_month: 100_000, tokens_per_month: 100_000_000, cost_usd_per_month: 25_000 },
    features: ["Everything in Team", "SSO/SCIM", "Audit log", "SLOs & remediation"],
  },
];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Harness" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [tab, setTab] = useState<Tab>("General");
  return (
    <>
      <PageHeader title="Settings" subtitle="Organization-wide configuration" />
      <div className="border-b border-[var(--border-default)] mb-6">
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative h-9 px-3 text-[13px] ${tab === t ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              {t}
              {tab === t && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-[var(--accent)]" />}
            </button>
          ))}
        </div>
      </div>
      {tab === "Billing" ? <BillingTab /> : (
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 max-w-2xl">
          <div className="space-y-4">
            {fieldsByTab[tab].map(([label, value]) => (
              <div key={label}>
                <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{label}</label>
                <input
                  defaultValue={value}
                  className="w-full h-10 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 text-[13px] font-mono-tabular focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              onClick={() => toast("Changes discarded")}
              className="h-9 px-3 rounded-md text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
            <button
              onClick={() => toast.success(`${tab} settings saved`)}
              className="h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
            >
              Save changes
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const meterIcons: Record<UsageMeter["name"], typeof Users> = {
  seats: Users,
  runs: Zap,
  tokens: Activity,
  cost_usd: Coins,
};

function BillingTab() {
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getBillingPlan);
  const fetchMeters = useServerFn(getUsageMeters);
  const changePlan = useServerFn(updateBillingPlan);

  const planQuery = useQuery({ queryKey: ["billing-plan"], queryFn: () => fetchPlan() });
  const metersQuery = useQuery({ queryKey: ["usage-meters"], queryFn: () => fetchMeters() });
  const plan = planQuery.data;
  const meters = metersQuery.data ?? [];

  const planMutation = useMutation({
    mutationFn: (tier: typeof PLAN_TIERS[number]) => changePlan({ data: tier }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-plan"] });
      qc.invalidateQueries({ queryKey: ["usage-meters"] });
      toast.success("Plan updated");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update plan"),
  });

  const currentPlanName = plan?.name ?? "Starter";

  return (
    <div className="space-y-6">
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="flex items-center gap-2 text-[var(--text-primary)] mb-4">
          <CreditCard className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-[15px] font-medium">Current plan</h3>
        </div>
        <div className="text-[13px] text-[var(--text-secondary)]">
          {plan ? planDisplayName(plan) : "Loading plan…"}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {plan?.features.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-elevated)] text-[11px] text-[var(--text-secondary)]">
              <Check className="h-3 w-3 text-[var(--success)]" /> {f}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <h3 className="text-[15px] font-medium text-[var(--text-primary)] mb-4">Usage this period</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {meters.map((m) => {
            const Icon = meterIcons[m.name];
            const pct = m.limit_value > 0 ? Math.min(100, (m.current_value / m.limit_value) * 100) : 0;
            const warn = pct >= 80;
            return (
              <div key={m.name} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                  <Icon className="h-3.5 w-3.5" /> {m.name.replace("cost_usd", "Spend").replace("_", " ")}
                </div>
                <div className="mt-2 text-[20px] font-mono-tabular text-[var(--text-primary)]">
                  {formatMeterValue(m.name, m.current_value)}
                  <span className="text-[13px] text-[var(--text-muted)]"> / {formatMeterValue(m.name, m.limit_value)}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: warn ? "var(--danger)" : "var(--accent)" }}
                  />
                </div>
                <div className={`mt-1 text-[11px] ${warn ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
                  {pct.toFixed(0)}% used
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <h3 className="text-[15px] font-medium text-[var(--text-primary)] mb-4">Change plan</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLAN_TIERS.map((tier) => {
            const active = currentPlanName === tier.name;
            return (
              <button
                key={tier.name}
                onClick={() => planMutation.mutate(tier)}
                disabled={active || planMutation.isPending}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]"
                } disabled:opacity-60`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-[var(--text-primary)]">{tier.name}</span>
                  <span className="text-[13px] font-mono-tabular text-[var(--text-secondary)]">${tier.price_usd}/mo</span>
                </div>
                <ul className="mt-3 space-y-1">
                  {tier.features.map((f) => (
                    <li key={f} className="text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5">
                      <Check className="h-3 w-3 text-[var(--success)] shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                {active && <div className="mt-3 text-[11px] text-[var(--accent)] font-medium">Current plan</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
