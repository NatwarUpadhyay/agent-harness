<div align="center">

![Harness](docs/hero.png)

# Harness

**Design, simulate, and share AI agent flows on a canvas.**

Live preview: **[harness-flow-control.lovable.app](https://harness-flow-control.lovable.app)**

</div>

---

## What it is

**Harness** is a visual operating system for AI agents. It gives you a node-based canvas where you can drag building blocks, wire them into agentic flows, and hit **Simulate** to watch the whole thing run step by step. Beyond the canvas, it includes a full enterprise stack: prompt versioning, experiments, datasets, evaluations, usage & cost tracking, audit logs, and scoped API keys.

It is built for teams who want a shared visual language for AI systems before writing code — makers sketching agent logic, engineers prototyping LLM pipelines, educators teaching control flow, and enterprise teams who need governance, observability, and access control around their AI workflows.

### Why use it

- **Sketch fast** — drag nodes from a sidebar and connect ports without any setup.
- **See it run** — simulation highlights each step and reveals how decisions propagate.
- **Start from templates** — choose from starter workflows to learn the tool quickly.
- **Iterate with prompts** — version, preview, and render `{{variable}}` templates in real time.
- **Run experiments** — A/B variants with animated trial batches and auto-detected winners.
- **Ground flows in data** — upload CSV/JSON/JSONL datasets and inspect them before wiring them in.
- **Track spend** — per-employee, per-model token usage and cost analytics with CSV export.
- **Stay compliant** — tamper-evident audit log and scoped API keys with request tracking.
- **Stay in flow** — undo/redo, auto-layout, snapshots, and a first-visit onboarding card keep the canvas friction-free.

---

## Current status

> **Published and playable** — the harness canvas is live with workflows, templates, simulation, and enterprise features. Cloud persistence is active for workflows, prompts, datasets, and API keys; data retention and organization-scoped controls are planned for later phases.

| Phase | Area | Status |
| --- | --- | --- |
| 1 | Auth, routing, app shell | Done |
| 2 | Dashboard + navigation | Done |
| 3 | Harness canvas (drag, drop, connect, simulate) | Done |
| 4 | Templates, save/load, export/import, undo/redo | Done |
| 5 | Auto-layout + onboarding | Done |
| 6 | Graphite design system + responsive polish | Done |
| 7 | Evaluations engine + command palette polish | Done |
| 8 | Harness usage analytics (tokens, latency, cost) | Done |
| 9 | Prompt library with versioning + variable rendering | Done |
| 10 | Experiments — A/B variants with simulated trials | Done |
| 11 | Datasets — upload, parse, preview CSV/JSON/JSONL/MD | Done |
| 12 | Cloud workflow management — rename, duplicate, delete | Done |
| 13 | Workflow favorites + search in the Load menu | Done |
| 14 | Public read-only workflow share links | Done |
| 15 | Vendor integrations hub + capability compatibility checks | Done |
| 16 | Community library — browse & clone public workflows across the org | Done |
| 17 | Live multi-cursor presence on the harness canvas | Done |
| 18 | Canvas snapshots — take, list, restore local graph checkpoints | Done |
| 19 | Usage & cost analytics — employee, model, and team spend | Done |
| 20 | Audit log — tamper-evident SHA-256 chained event log | Done |
| 21 | API key management — scoped keys, request tracking | Done |
| 22 | Live collaboration activity stream | Done |
| 23 | Real-time collaborative node editing | Done |
| **24** | **Node comments — threaded discussion per canvas node** | **Shipped** |
| **25** | **Alerts & incidents — rule-driven alerting console** | **Shipped** |
| 26 | Governance & org-scoped controls | Done |
| **27** | **Budgets & forecasting — per-team spend caps and breach enforcement** | **Shipped** |
| **28** | **Optimizer — advanced RAG & memory tuning suggestions with impact estimates** | **Shipped** |
| **29** | **Org control room + onboarding wizard — company-wide cost, latency, department roll-ups** | **Shipped** |
| 30 | Regression test suite (Vitest + Testing Library) across canvas, dashboard, auth | Done |
| **31** | **Spend enforcement — real-time budget breach enforcement & burn-rate anomaly detection** | **Shipped** |
| **32** | **Workflow topology audit — cycle detection, orphans, critical path** | **Shipped** |
| **33** | **Reliability SLOs & error budgets — per-service burn-down, time-to-exhaustion** | **Shipped** |
| **34** | **Enterprise SSO/SCIM — SAML/OIDC admin console, directory sync, domain enforcement** | **Shipped** |
| **35** | **Server-persisted org data + live SCIM provisioning endpoint** | **Shipped** |
| **Next** | Production execution engine — run harness workflows against live LLMs and tools | Planned |


---

## What's inside

- **Harness Canvas** — React Flow workspace with drag-from-sidebar node creation, edge connections, viewport-aware drop, and topological auto-layout.
- **Simulate** — Run any wired flow and watch each node activate in sequence.
- **Usage analytics** — Every simulation records tokens, latency, and estimated cost per node type, surfaced live on the harness page.
- **Prompt library** — Versioned prompts with `{{variable}}` extraction and live rendering; save new versions with notes.
- **Experiments** — Define two variants with custom success-rate + latency knobs, run animated trial batches, and auto-detect a winner. Trials feed the harness usage analytics.
- **Datasets** — Drag-drop upload for CSV, JSON, JSONL, and Markdown with automatic parsing, column detection, and a first-50-rows preview drawer.
- **Evaluations** — Dataset picker, weighted rubric panel, per-run drawer, and two-run comparison with per-metric deltas.
- **Usage & cost** — Per-employee, per-model token tracking, daily spend charts, team filters, and CSV export.
- **Audit log** — Tamper-evident SHA-256 chained event log with filtering, inspection, and export.
- **API keys** — Scoped keys (read / write / admin), environment tags, and request tracking.
- **Templates** — Pre-built starter workflows to load and experiment with.
- **Save / Load / Export / Import** — Persist flows locally as JSON and share them between sessions or users.
- **Undo / Redo** — Step through canvas changes without fear.
- **Command palette** — Fuzzy search, recent actions, and a `?` shortcut overlay.
- **Onboarding** — Dismissible first-visit guide that teaches _drag → connect → simulate_ in three steps.
- **Dashboard** — Landing surface with project overview and navigation into the harness.
- **Optimizer** — Advanced RAG and memory-optimization suggestions (hybrid retrieval, episodic compression, chunk tuning) with estimated cost/latency impact.
- **Retriever, Models, Research, Deployments** — Interactive control surfaces with live metrics, filters, and persisted local state.
- **Org control room & onboarding** — Guided org setup plus company-wide KPI strip, spend charts, and department roll-ups.
- **Governance** — Role capability matrix, member invites, SSO and IP-allowlist controls.
- **Enterprise SSO/SCIM** — SAML/OIDC admin console with domain enforcement, server-persisted organization settings, and a live SCIM 2.0 `/api/public/scim/v2` provisioning endpoint for Okta, Entra, and Google Workspace directories.
- **Budgets & alerts** — Per-team spend caps with burn-down forecasting, plus rule-driven alerting and an incident triage console.
- **Spend enforcement** — Real-time budget breach enforcement (notify / throttle / block) with a run simulator, z-score burn-rate anomaly detection, a live enforcement log, and CSV export.
- **Integrations & library** — Vendor capability matrix with compatibility checks, and a community library for cloning public workflows.
- **Collaboration** — Multi-cursor presence, activity stream, collaborative node editing, threaded node comments, and canvas snapshots.
- **Share links** — Public read-only workflow views at `/share/:id`.
- **Design system** — Graphite palette (`#0A0A0B` base, restrained cool accent), JetBrains Mono headings, Work Sans body.

## Context Mapping & Token Optimization

Harness includes an advanced context mapping system that enables token-efficient AI agent interactions. This system analyzes your codebase to build a knowledge graph with dependency tracking, circular dependency detection, and token optimization for fast agent context loading.

### Features
- **Knowledge Graph**: Complete mapping of file relationships, imports, and entities
- **Token Optimization**: Load only relevant context (typically 5-10KB vs 50KB+) per agent query  
- **Loop Detection**: Automatic circular dependency identification using DFS algorithms
- **Semantic Clustering**: Group files by directory and type for intelligent context retrieval
- **Entry Point Detection**: Identify key files with no incoming dependencies for workflow initiation

### Usage
The context system is located in `/context/` and includes:
- `knowledge_graph.json`: Complete graph of your codebase relationships
- `graph_builder.py`: Tool to regenerate the context map
- `loops/loop_detection.py`: Circular dependency analyzer
- `integration_template/`: Drop-in components for any AI project

To rebuild the context map:
```bash
python3 context/graph_builder.py
```

To check for circular dependencies:
```bash  
python3 context/loops/loop_detection.py
```

## Testing

Vitest + Testing Library regression suite covering the main interactive surfaces: harness canvas, dashboard, evaluations, agents, layout controls, usage math, and auth flows. Runs green (8 files / 14 tests) alongside a clean TypeScript check.

The current suite is a focused smoke/regression layer rather than exhaustive coverage for every page, so it is a good starting point for validating future UI changes.

---

## Tech stack

- **TanStack Start v1** (React 19, Vite 7, SSR-ready)
- **TanStack Router** file-based routing + **TanStack Query**
- **Tailwind CSS v4** with a semantic token design system
- **shadcn/ui** + Radix primitives
- **React Flow** for the harness canvas
- **Lovable Cloud** (Supabase) for auth, database, and edge functions
- **Zustand** for lightweight UI state

---

## Getting started

```bash
bun install
bun dev
```

Then open the local URL Vite prints. The published app is already live at:

**https://harness-flow-control.lovable.app**

### Environment

`.env` is auto-managed by Lovable Cloud. Do not edit `VITE_SUPABASE_*` values by hand.

---

## Try it live

The fastest way to understand Harness is to use the preview:

1. Open **[harness-flow-control.lovable.app](https://harness-flow-control.lovable.app)**.
2. Go to the **Harness** section.
3. Drag a node from the sidebar onto the canvas.
4. Drag a connection from one node's output port to another node's input port.
5. Click **Simulate** and watch the flow run.
6. Open **Usage** to see token and cost analytics per simulation.
7. Export the JSON or create a public share link if you want to save or share it.

---

## What shipped recently

- **Phase 19 — Usage & cost analytics.** Per-employee, per-model token tracking, daily spend charts, team filters, and CSV export for enterprise cost visibility.
- **Phase 20 — Audit log.** Tamper-evident SHA-256 chained event log with category/severity filters, event inspection drawer, and CSV export.
- **Phase 21 — API key management.** Scoped keys (read / write / admin), environment tags, last-used tracking, and request analytics.
- **Phase 22 — Live collaboration activity stream.** A frosted-glass activity feed on the harness canvas showing peer edits (add, connect, edit, comment, delete) in real time, wired to the existing presence layer.
- **Phase 23 — Real-time collaborative node editing.** Peer "locks" show up directly on canvas nodes with a colored ring, pulsing dot, and a name badge ("Nat editing", "Priya moving"), so you can see who's touching which node as it happens.
- *(Fixes)* Shared workflow view now uses the styled HarnessNode, API-key revocations persist correctly, Usage CSV exports actual rows, presence overlay throttles to 3s updates, and the integrations compatibility checker ranks fully compatible vendors first.

- **Phase 25 — Alerts & incidents.** A rule-driven alerting console covering cost, latency, error-rate, and audit-anomaly metrics with severity levels and Slack / email / PagerDuty / webhook routing. Fire rules to generate incidents, then acknowledge, resolve, or reopen them. Rules and incidents persist locally.
- **Phase 26 — Governance & org-scoped controls.** A `/governance` page with a role capability matrix (owner → viewer) and CSV export, member management with live role re-scoping and invites, just-in-time access requests with approve/deny trails, and org controls for SSO enforcement, SCIM, MFA, IP allowlisting, data residency (US/EU/IN), and trace retention. All state persists locally.
- **Phase 27 — Budgets & forecasting.** A `/budgets` page with per-team monthly/quarterly spend caps, live utilization bars, month-end burn-down forecasting against the cap line, and breach enforcement modes (notify, throttle, hard-block). Create, pause, raise, or delete budgets and export the whole ledger to CSV; all state persists locally.

- **Phase 31 — Spend enforcement.** A `/enforcement` page that turns budget caps into live action: trigger simulated agent runs against a team's cap and watch enforcement fire in real time (allow → throttle to 40% throughput → hard-block on breach). A 24-hour burn-rate chart runs z-score anomaly detection (σ > 2.2) and marks spikes on the graph; detected anomalies and enforcement actions stream into a live, exportable enforcement log.

- **Phase 32 — Workflow topology audit.** A `/topology` page that runs the same graph + loop analysis used by the repo context tooling against your agent flows: cycle/self-loop detection, orphan and unreachable nodes, dead ends, high fan-out, an animated structural-health score, the highest-latency critical path, acknowledgeable findings and CSV export.

- **Phase 33 — Reliability SLOs & error budgets.** A `/reliability` page with per-service objectives (availability and p95 latency), rolling 28-day error budgets, burn-rate math (`bad / requests ÷ allowed`), time-to-exhaustion forecasts, severity escalation at 2x / 6x burn, an error-budget burn-down chart against the ideal pace line, per-objective recommended actions, acknowledgement, and CSV export. Budget math lives in `src/lib/data/slo.ts` as pure functions with unit tests.

- **Phase 35 — Server-persisted org data + live SCIM provisioning.** Enterprise Auth settings now sync to Lovable Cloud (`org_settings` table) with RLS, so configuration survives across devices and sessions. A public SCIM 2.0 endpoint is live at `/api/public/scim/v2` (Users CRUD, ServiceProviderConfig) for Okta/Entra/Google Workspace directory sync, backed by the same org settings row.

- **Phase 36 — Production execution engine.** A `/runs` page that executes any saved harness workflow against live models through the Lovable AI gateway: nodes run in topological order, each stage's system prompt is derived from its node type, and every step's output, tokens, latency and cost are persisted to a `workflow_runs` table with RLS. Failed nodes short-circuit downstream stages (marked `skipped`), and the history view expands into a full per-node trace with the final output.

## Next up

Scheduled and triggered runs: cron schedules, webhook triggers and alert hooks on top of the execution engine, so workflows fire without a human in the loop.




---

## Contributing

This project is developed inside [Lovable](https://lovable.dev) with two-way GitHub sync. You can:

- Edit in Lovable — changes push to `main` automatically.
- Or clone locally, push to GitHub — changes sync back to Lovable.

```bash
git clone <your-repo-url>
cd harness
bun install
bun dev
```

---

## License

MIT — use it, extend it, and build better flows.
