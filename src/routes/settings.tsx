import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";

const tabs = ["General", "Team", "API keys", "Billing", "Integrations"] as const;
type Tab = (typeof tabs)[number];

const fieldsByTab: Record<Tab, Array<[string, string]>> = {
  General:       [["Organization name", "Acme AI"], ["Default region", "us-east-1"], ["Timezone", "America/New_York"]],
  Team:          [["Owner", "avery@acme.ai"], ["Seats used", "12 / 25"], ["SSO provider", "Okta"]],
  "API keys":    [["Public key", "pk_live_•••••••••••• 38af"], ["Last rotated", "2025-06-14"], ["Rate limit", "1000 req/min"]],
  Billing:       [["Plan", "Enterprise"], ["MTD spend", "$2,847.41"], ["Next invoice", "2025-07-01"]],
  Integrations:  [["Slack", "Connected · #ai-ops"], ["PagerDuty", "Not connected"], ["Datadog", "Connected"]],
};

export const Route = createFileRoute("/settings")({
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
          <button className="h-9 px-3 rounded-md text-[13px] text-[var(--text-secondary)]">Cancel</button>
          <button className="h-9 px-3 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)]">Save changes</button>
        </div>
      </div>
    </>
  );
}
