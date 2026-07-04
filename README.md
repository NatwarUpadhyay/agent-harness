<div align="center">

![Onyx Agents](docs/hero.png)

# Onyx Agents

**A visual platform to build, evaluate, and observe AI agent workflows.**

Design multi-step agents on a canvas, wire them to tools and memory, run them against datasets, and trace every token in production — all with an Onyx-graphite, Apple/OpenAI-inspired UI.

</div>

---

## Why this exists

Shipping reliable AI agents is still messy: prompts live in notebooks, tools live in scripts, evals live in spreadsheets, and production traces live nowhere. **Onyx Agents** brings the full lifecycle into one workspace so builders can go from idea → agent → eval → deployment without stitching five tools together.

It's useful if you are:

- **A solo builder** prototyping an agent and want a visual canvas instead of raw code.
- **An AI team** that needs shared datasets, evaluations, and traces.
- **A platform engineer** deploying agents and needing observability + policies.
- **A researcher** running planners and comparing model behavior side-by-side.

---

## Current status

> **Phase 7 complete** — Core platform surfaces are live, styled, and wired to synthetic data. Ready to start Phase 8.

| Phase | Area | Status |
| --- | --- | --- |
| 1 | Auth, routing, app shell | Done |
| 2 | Dashboard + metrics | Done |
| 3 | Agents, prompts, tools, models | Done |
| 4 | Datasets, memory, context, retriever | Done |
| 5 | Harness canvas (drag-and-drop, auto-layout) | Done |
| 6 | Observability traces + waterfalls | Done |
| 7 | Onyx Graphite design system (Apple/OpenAI-inspired) | Done |
| **8** | **Evaluations engine + Command palette polish** | **Next** |
| 9 | Deployments + policies | Planned |
| 10 | Experiments + planner comparison | Planned |
| 11 | MCP integrations | Planned |
| 12 | Real backend wiring (Lovable Cloud) | Planned |

---

## What's inside

- **Harness** — React Flow canvas with drag-from-sidebar, viewport-aware drop positioning, and topological auto-layout.
- **Agents / Prompts / Tools / Models** — CRUD-style surfaces for the building blocks.
- **Datasets & Memory** — Manage evaluation data and long-term agent memory.
- **Observability** — Trace list, span waterfall, token/latency charts.
- **Dashboard** — Live-feel metrics with monochrome charts.
- **Command palette** — `⌘K` navigation across every surface.
- **Design system** — Onyx Graphite palette (`#0A0A0B` base, restrained cool accent), JetBrains Mono headings, Work Sans body.

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

Then open the local URL Vite prints. Sign in through the login screen (Lovable Cloud auth) and you'll land on the dashboard.

### Environment

`.env` is auto-managed by Lovable Cloud. Do not edit `VITE_SUPABASE_*` values by hand.

---

## Next up — Phase 8

1. **Evaluations engine** — dataset × agent runs, pass/fail rubrics, diff view between runs.
2. **Command palette polish** — recent actions, fuzzy entity search, keyboard shortcuts overlay.
3. **Empty-state pass** — every surface gets a purposeful empty state with a next action.

After Phase 8 the platform will be feature-complete enough to swap the synthetic data layer for real backend tables.

---

## Contributing

This project is developed inside [Lovable](https://lovable.dev) with two-way GitHub sync. You can:

- Edit in Lovable — changes push to `main` automatically.
- Or clone locally, push to GitHub — changes sync back to Lovable.

```bash
git clone <your-repo-url>
cd onyx-agents
bun install
bun dev
```

---

## License

MIT — do whatever helps you ship better agents.
