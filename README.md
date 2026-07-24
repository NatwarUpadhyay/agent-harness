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
| **23** | **Real-time collaborative node editing** | **Shipped** |
| **24** | **Next phase — TBD** | **Next** |

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
- **Design system** — Graphite palette (`#0A0A0B` base, restrained cool accent), JetBrains Mono headings, Work Sans body.

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

## Next up

Governance and org-scoped controls — data retention, workspace roles, and organization-wide policy enforcement across workflows.

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
