# Harness demo test plan

## Purpose

Use this document to rehearse and validate a reliable Harness demo. It is intentionally strict about what can be demonstrated as real product behavior, what is browser-local, and what is simulated.

The demo should sell one clear MVP promise:

> Teams can visually design, simulate, save, and share AI-agent workflows before implementing them.

Do not position the current build as a production agent runtime, enterprise telemetry system, or organization-wide project tracker.

## Current truth map

| Area                                                                         | Source of truth                                  | Safe demo claim                                                                                      | Do not claim                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Authentication                                                               | Supabase Auth                                    | Users can sign in and access their own workspace.                                                    | Enterprise SSO, SCIM, or production-grade identity governance.                 |
| Agents and tools                                                             | Supabase tables with user-scoped RLS             | Agents and tools can be created and managed per user.                                                | Their metrics reflect real live agent calls.                                   |
| Workflows                                                                    | Supabase `workflows` table with user-scoped RLS  | Workflows save, reload, duplicate, favorite, and can be publicly shared.                             | Workflows execute real models or tools.                                        |
| Public sharing/library                                                       | Supabase public-workflow query                   | A user can share an opted-in workflow as a read-only canvas, once the sharing migration is deployed. | Sharing is a private, expiring, revocable-link security product.               |
| Harness simulation                                                           | Client-side canvas logic                         | The canvas visually simulates a flow and estimates latency, token use, and cost.                     | The numbers come from actual provider usage or a real runtime.                 |
| Projects                                                                     | Browser `localStorage`                           | A single browser can create, search, and delete lightweight project records.                         | Projects track agents, prompts, runs, spending, or work across a team.         |
| Prompts, datasets, experiments, usage, alerts, budgets, governance, API keys | Mostly browser `localStorage` and/or seeded data | These are product-concept prototypes that can be explored in one browser.                            | They are cloud-persisted, shared, enforced, auditable, or production accurate. |
| Comments, snapshots, presence, and co-editing                                | Browser-local state and generated personas       | Show only as a local interaction concept.                                                            | Live, durable, multi-user collaboration.                                       |
| Integrations/retriever/observability                                         | Static, deterministic, or simulated data         | Show as future-direction UI only if the audience understands it is a prototype.                      | Connected vendor integrations, live retrieval, or live traces.                 |

## Pre-flight checklist

Run this on the exact deployment/browser profile that will be used for the demo.

- [ ] `npm run test:run` is green.
- [ ] `npm run build` is green.
- [ ] The deployed preview loads over HTTPS.
- [ ] Sign in with a prepared demo account; do not create an account during the meeting.
- [ ] Verify the account has at least one saved workflow and can access the Harness page.
- [ ] Use a clean, named browser profile for the demo. Browser-local prototype data is profile-specific.
- [ ] Disable browser extensions and close unrelated tabs/notifications.
- [ ] Prepare a second private/incognito window for the public-share check.
- [ ] If testing record isolation, prepare a second demo account in a separate browser profile.
- [ ] Ensure the network is stable. Keep a short screen recording or screenshots as a fallback.
- [ ] Start with a simple workflow template, not an empty canvas.

### Current known build gate

`npm run lint` currently fails due to widespread Prettier formatting violations. Do not use a green lint result as a release gate until formatting is fixed. It should be resolved before a formal customer or investor demo.

## Demo data setup

Use consistent names so the expected results are obvious on screen.

| Item                  | Suggested value                            | Why                                                           |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Workflow              | `Support triage — demo`                    | Easy to explain: intake → classify → retrieve → respond.      |
| Alternative workflow  | `Sales routing — demo`                     | Supports save/load and search demonstrations.                 |
| Agent                 | `Triage assistant — demo`                  | Makes the agents list clearly identifiable.                   |
| Tool                  | `kb_search_demo`                           | Makes tool creation/toggle visible.                           |
| Public workflow       | `Support triage — public demo`             | Safe record to share without sensitive content.               |
| Local project records | `Pilot Alpha`, `Pilot Beta`, `Pilot Gamma` | Used only to demonstrate local create/search/delete behavior. |

Never place customer content, API secrets, personal data, or actual production prompts in a workflow that may be publicly shared.

## Recommended six-minute MVP demo

### 1. Establish the problem and workflow canvas — 30 seconds

1. Open **Harness**.
2. Say: “We give product and engineering a shared visual language for agent workflows before implementation.”
3. Load `Support triage — demo` from templates or saved workflows.

Pass criteria:

- The canvas renders with visible nodes and edges.
- The workflow name is clear and the screen is not empty.

### 2. Show composition — 75 seconds

1. Add one node from the sidebar.
2. Connect it to the next relevant node.
3. Select the node and change a safe visible property.
4. Use auto-layout if the graph needs cleanup.
5. Optionally use undo and redo once.

Pass criteria:

- The new node appears at the intended position.
- The edge connects successfully.
- The canvas remains readable and responsive.

### 3. Show the simulation — 75 seconds

1. Click **Simulate**.
2. Let the sequence complete; do not interrupt it unless demonstrating Stop deliberately.
3. Open the usage panel and point to the recorded run.
4. Say: “This is a design-time simulation with estimated token, latency, and cost signals—not live model execution.”

Pass criteria:

- Each node animates in a sensible graph order.
- A completion message appears.
- One new run is visible in the local usage panel.

### 4. Save and recover the workflow — 60 seconds

1. Save as `Support triage — demo`.
2. Make a small, visible canvas change.
3. Reload the saved workflow and verify the change is reverted.
4. Duplicate it and rename the duplicate `Support triage — public demo`.

Pass criteria:

- Save succeeds without an error toast.
- Load restores the saved nodes and edges.
- Duplicate/rename appears in the saved-workflow list after refresh.

### 5. Public read-only sharing — 60 seconds

1. Mark only `Support triage — public demo` as public.
2. Copy/open its share URL in an incognito window.
3. Verify the workflow renders, is read-only, and cannot be edited.
4. Return to the signed-in window and unshare it after the demo if the link should not remain available.

Pass criteria:

- The anonymous viewer sees the expected workflow and title.
- Canvas editing controls do not change the graph.
- A non-public workflow URL produces the “Workflow not available” state.

### 6. Close on the MVP — 40 seconds

1. Return to the Harness canvas.
2. Summarize: “The validation question is whether visual design and simulation meaningfully shorten the path from an agent idea to an implementation-ready flow.”
3. Invite design partners to bring one workflow that is currently hard to communicate or review.

## Test scenarios

Execute the following before each important demo. Mark any failed **P0** or **P1** scenario as a no-demo condition until it is fixed or a safe workaround has been rehearsed.

| ID      | Priority | Scenario                            | Steps                                                                                                                                         | Expected result                                                                          |
| ------- | -------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| DEMO-01 | P0       | Authentication gate                 | Open a protected URL signed out, then sign in.                                                                                                | Protected route redirects to login; valid user reaches the intended page.                |
| DEMO-02 | P0       | Load template                       | Open Harness and load a starter workflow.                                                                                                     | Nodes/edges render without console-visible UI errors.                                    |
| DEMO-03 | P0       | Compose flow                        | Drag a node, connect it, edit it, auto-layout, undo/redo.                                                                                     | Each operation changes only the intended canvas state.                                   |
| DEMO-04 | P0       | Simulate flow                       | Simulate a non-empty, acyclic workflow.                                                                                                       | Highlighting completes and one estimated usage run is recorded.                          |
| DEMO-05 | P0       | Save/load workflow                  | Save, refresh, load, rename, and duplicate a workflow.                                                                                        | Cloud-backed workflow state survives refresh and actions affect only the owner’s record. |
| DEMO-06 | P0       | Anonymous share                     | Publicly share a deliberately safe workflow; open the link signed out.                                                                        | The graph is visible and read-only; a private/unshared graph is not returned.            |
| DEMO-07 | P1       | Agent CRUD                          | Create and remove `Triage assistant — demo`. Refresh after each change.                                                                       | The record persists for the signed-in user.                                              |
| DEMO-08 | P1       | Tool CRUD                           | Create `kb_search_demo`, toggle it, refresh, then remove it.                                                                                  | The state persists for the signed-in user.                                               |
| DEMO-09 | P1       | Canvas resilience                   | Try to create an invalid connection and simulate an empty canvas.                                                                             | The app blocks/rejects the action cleanly and shows useful feedback.                     |
| DEMO-10 | P1       | Small viewport                      | Repeat DEMO-02 through DEMO-04 at mobile width.                                                                                               | Navigation, controls, and canvas remain usable; no critical control is hidden.           |
| DEMO-11 | P2       | Project local prototype             | Create Alpha/Beta/Gamma; search Beta; refresh; delete Beta.                                                                                   | Browser-local records persist only in that browser profile.                              |
| DEMO-12 | P2       | Prompt/dataset/experiment prototype | Create/modify one local item and reload the page.                                                                                             | State survives page reload in the same browser, but is treated as a prototype.           |
| DEMO-13 | P1       | User isolation and unshare          | With a second user, verify private agent/tool/workflow records are unavailable; then unshare a public workflow and retest its URL signed out. | Private records remain user-scoped and an unshared URL becomes unavailable.              |

## Data-accuracy audit

Perform these checks if anyone asks whether a screen tracks “real” data.

| Claim being tested                            | Test                                                                                      | Accurate conclusion today                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| “Projects contain agents”                     | Create a project, create or delete an agent, refresh both screens.                        | False: no project-to-agent relationship exists.                                                    |
| “Project agent totals are real”               | Create a project and inspect its total; change agent records.                             | False: a project stores a standalone number; new projects use a default of 1.                      |
| “Agent metrics reflect live runtime activity” | Create an agent and inspect success, calls, and latency before/after a canvas simulation. | False: agent metrics are seeded/manual values and are not connected to a runtime.                  |
| “Dashboard shows live usage”                  | Run a simulation, then compare dashboard and usage pages after refresh.                   | Partly false: the canvas records local estimated usage; dashboard also uses seeded/static metrics. |
| “Usage/cost is provider-accurate”             | Compare simulated values to an actual provider invoice/run.                               | False: values are client-side estimates.                                                           |
| “Alerts/budgets enforce policy”               | Create a rule/budget and try a run that would breach it.                                  | False for server-side enforcement; these are local prototype controls.                             |
| “Collaboration is shared editing”             | Make a change in one browser, inspect it in another account/browser.                      | False today: presence/activity/co-edit cues are generated/local, not durable multi-user editing.   |
| “Public sharing is safe”                      | Open public/private links signed out; inspect the contents of a shared graph.             | It is an opt-in public read-only graph. Treat every shared node payload as publicly visible.       |

## Negative and recovery tests

These tests prevent a demo from derailing.

- [ ] Open a non-existent share URL: the friendly unavailable state appears.
- [ ] Open a private workflow’s share URL signed out: it is unavailable.
- [ ] Simulate an empty canvas: clear feedback appears rather than a crash.
- [ ] Reload during a canvas operation: saved workflow can be recovered from the Load menu.
- [ ] Briefly lose network after saving: capture the error behavior and rehearse the fallback to a saved template.
- [ ] Use a fresh browser profile: expect no browser-local prompts/projects/datasets/usage history, but expect cloud-backed workflows after sign-in.
- [ ] Use a second browser/account: verify only the specifically public workflow is shared; do not expect local prototype state to transfer.
- [ ] Import malformed workflow JSON: the app rejects it gracefully and leaves the current canvas intact.

## Evidence to capture

For a release or investor/customer demo, retain a short evidence bundle:

- [ ] Screenshot/video of template → compose → simulate.
- [ ] Screenshot/video of save → refresh → load.
- [ ] Screenshot of public share in an anonymous window.
- [ ] `npm run test:run` output.
- [ ] `npm run build` output.
- [ ] A written list of known prototype-only areas from the current truth map.
- [ ] Date, deployment URL, browser/version, and demo-account identifier.

## Current automated coverage

The repository has Vitest regression tests for the harness canvas, dashboard, evaluations, auth flows, agents, layout, usage math, and projects. The projects test intentionally validates the current browser-local behavior: create three projects, filter, remount, and delete.

Automated coverage does **not** prove real multi-user collaboration, cloud persistence for browser-local modules, provider accuracy, deployment availability, or end-to-end public-sharing security. Those must be manually tested before each external demo.

## Go / no-go decision

### Go

Proceed when all P0 tests pass, the test/build commands pass, public sharing has been checked in an anonymous browser, and the presenter uses only safe claims from the current truth map.

### No-go or narrow the demo

Do not run the full workflow demo when authentication, canvas loading, simulation, save/load, or public-sharing checks fail. If a prototype-only module is unstable, omit it rather than improvising around it.

## Test-run record

Copy this into a demo-prep issue or release note.

```text
Date:
Deployment URL:
Browser/profile:
Demo account:
Tester:

DEMO-01: pass / fail
DEMO-02: pass / fail
DEMO-03: pass / fail
DEMO-04: pass / fail
DEMO-05: pass / fail
DEMO-06: pass / fail
DEMO-07: pass / fail
DEMO-08: pass / fail
DEMO-09: pass / fail
DEMO-10: pass / fail
DEMO-11: pass / fail
DEMO-12: pass / fail
DEMO-13: pass / fail

Known limitations stated in demo:
Workaround/fallback:
Go / no-go decision:
```
