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

> **Published and playable** — the harness canvas is live as a public playground with demo workflows, templates, and simulation. Backend persistence is still synthetic/demo data.

| Phase | Area | Status |
| --- | --- | --- |
| 1 | Auth, routing, app shell | Done |
| 2 | Dashboard + metrics | Done |
| 3 | Agents, prompts, tools, models | Demo data |
| 4 | Datasets, memory, context, retriever | Demo data |
| 5 | Harness canvas (drag-and-drop, auto-layout, simulate) | Done |
| 6 | Observability traces + waterfalls | Demo data |
| 7 | Onyx Graphite design system + shared layout | Done |
| **8** | **Evaluations engine + command palette polish** | **Next** |
| 9 | Deployments + policies | Planned |
| 10 | Experiments + planner comparison | Planned |
| 11 | MCP integrations | Planned |
| 12 | Real backend wiring (Lovable Cloud) | Planned |

---

## What's inside

- **Harness Canvas** — React Flow workspace with drag-from-sidebar node creation, edge connections, viewport-aware drop, and topological auto-layout.
- **Simulate** — Run any wired flow and watch each node activate in sequence.
- **Templates** — Pre-built starter workflows to load and experiment with.
- **Save / Load / Export / Import** — Persist flows locally as JSON and share them between sessions or users.
- **Undo / Redo** — Step through canvas changes without fear.
- **Onboarding** — Dismissible first-visit guide that teaches _drag → connect → simulate_ in three steps.
- **Dashboard** — Landing surface with project metrics and navigation into each area.
- **Design system** — Dark Onyx Graphite palette (`#0A0A0B` base, restrained cool accent), JetBrains Mono headings, Work Sans body.

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
2. Pick the **Harness** section.
3. Drag a node from the sidebar onto the canvas.
4. Drag a connection from one node's output port to another node's input port.
5. Click **Simulate** and watch the flow run.
6. Export the JSON if you want to save or share it.

---

## Next up — Phase 8

1. **Evaluations engine** — dataset × run results, pass/fail rubrics, and diff views.
2. **Command palette polish** — `⌘K` recent actions, fuzzy search, and keyboard shortcut overlay.
3. **Empty-state pass** — purposeful empty states with clear next actions on every surface.

After Phase 8 the platform will be feature-complete enough to swap the synthetic data layer for real backend tables.

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
