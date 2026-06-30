import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { StatusDot } from "@/components/ui/status-badge";

const servers = [
  { id: "m1", name: "github-mcp",    url: "mcp://github.internal:5111",     status: "active", tools: 18 },
  { id: "m2", name: "snowflake-mcp", url: "mcp://snowflake.dwh:5112",       status: "active", tools: 6  },
  { id: "m3", name: "stripe-mcp",    url: "mcp://stripe.proxy:5113",        status: "idle",   tools: 11 },
  { id: "m4", name: "jira-mcp",      url: "mcp://jira.tools.svc:5114",      status: "active", tools: 9  },
  { id: "m5", name: "fs-mcp",        url: "mcp://localhost:5115",           status: "error",  tools: 4  },
  { id: "m6", name: "shopify-mcp",   url: "mcp://shopify.proxy:5116",       status: "active", tools: 14 },
];

export const Route = createFileRoute("/_authenticated/mcp")({
  head: () => ({ meta: [{ title: "MCP — Harness" }] }),
  component: () => (
    <>
      <PageHeader title="MCP servers" subtitle="Model Context Protocol endpoints exposing tools and resources" />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
        {servers.map((s) => (
          <div key={s.id} className="px-5 py-3 flex items-center gap-4">
            <StatusDot status={s.status} />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium">{s.name}</div>
              <div className="text-[11px] font-mono-tabular text-[var(--text-muted)] truncate">{s.url}</div>
            </div>
            <span className="text-[11px] text-[var(--text-secondary)] font-mono-tabular w-20 text-right">{s.tools} tools</span>
            <button className="h-7 px-2.5 rounded-md text-[12px] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--danger)] hover:border-[var(--danger)]/40">
              Disconnect
            </button>
          </div>
        ))}
      </div>
    </>
  ),
});
