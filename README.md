<div align="center">

![Harness](docs/hero.png)

# Harness

**Design, simulate, and share process flows on a canvas.**

Live preview: **[harness-flow-control.lovable.app](https://harness-flow-control.lovable.app)**

</div>

---

## What it is

**Harness** is a visual workflow playground. It gives you a node-based canvas where you can drag building blocks, connect them into a flow, and hit **Simulate** to watch the whole thing run step by step.

It's built for anyone who thinks better with a diagram than with a config file — makers sketching logic, engineers prototyping pipelines, educators teaching control flow, or teams who want a shared visual language before writing code.

### Why use it

- **Sketch fast** — drag nodes from a sidebar and connect ports without any setup.
- **See it run** — simulation highlights each step and reveals how decisions propagate.
- **Start from templates** — choose from starter workflows to learn the tool quickly.
- **Take it with you** — save, load, export, and import flows as JSON.
- **Stay in flow** — undo/redo, auto-layout, and a first-visit onboarding card keep the canvas friction-free.

---

## Current status

> **Published and playable** — the harness canvas is live as a public playground with demo workflows, templates, and simulation. Data persistence is currently local/export-based; cloud save is planned for later phases.

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
| **15** | **Org-scoped libraries + live multi-cursor editing** | **Next** |


---

## What's inside

- **Harness Canvas** — React Flow workspace with drag-from-sidebar node creation, edge connections, viewport-aware drop, and topological auto-layout.
- **Simulate** — Run any wired flow and watch each node activate in sequence.
- **Usage analytics** — Every simulation records tokens, latency, and estimated cost per node type, surfaced live on the harness page.
- **Prompt library** — Versioned prompts with `{{variable}}` extraction and live rendering; save new versions with notes.
- **Experiments** — Define two variants with custom success-rate + latency knobs, run animated trial batches, and auto-detect a winner. Trials feed the harness usage analytics.
- **Datasets** — Drag-drop upload for CSV, JSON, JSONL, and Markdown with automatic parsing, column detection, and a first-50-rows preview drawer.
- **Evaluations** — Dataset picker, weighted rubric panel, per-run drawer, and two-run comparison with per-metric deltas.
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
6. Export the JSON if you want to save or share it.

---

## What shipped recently

- **Phase 8 — Usage analytics.** Live tokens/latency/cost tracker on the harness page, per-node type breakdown, persisted across sessions.
- **Phase 9 — Prompt library.** Versioned prompts, `{{variable}}` extraction, live rendering, per-version notes.
- **Phase 10 — Experiments.** Two-variant A/B setup, animated trial batches, auto-detected winner, trials feed usage analytics.
- **Phase 11 — Datasets.** Drag-drop CSV/JSON/JSONL/Markdown upload with parsing, column detection, and preview drawer.
- **Phase 12 — Cloud workflow management.** Rename, duplicate, and delete saved workflows directly from the Load menu, backed by Lovable Cloud.
- **Phase 13 — Workflow favorites + search.** Star workflows and filter the Load menu with instant search.
- **Phase 14 — Public share links.** Toggle any saved workflow to public and share a read-only `/share/:id` URL that opens without a login.

## Next up — Phase 15

Org-scoped libraries and live multi-cursor editing on the harness canvas.



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
