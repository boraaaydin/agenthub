# Show agent logos and the project name (not the path) in the console session list

---
**Execution Guidelines**: Before starting this task, ensure you've read `.agent/commands/tasks/do-task.md` (if not already read in this session). This file contains essential guidelines on how to properly execute tasks, including dependency checking, verification steps, and archival procedures.

**Application-specific documentation**: This repository is a single application; there is no `apps/{APP_NAME}/` directory. Read `.agent/PROJECT_DOCUMENT.md` before starting — it carries the project's purpose, target architecture, tech stack and verification commands.

When this task file is read standalone, the agent should:
1. Check if `do-task.md` has been read in the current session
2. If not, read it first to understand the execution workflow
3. Read `.agent/PROJECT_DOCUMENT.md` before starting the task
4. Then proceed with this specific task
---

## Description

On `/console`, each row of the left-hand session list (`src/app/console/session-sidebar.tsx`)
currently renders three lines:

1. a state dot plus the agent's text label — `Codex` or `Claude Code`,
2. the session's working directory as a full monospace path (`session.cwd`),
3. `Live` / `Exited`.

Two changes are requested:

- **Drop the path.** The raw `cwd` line must go.
- **Show logos instead of agent names.** The words `Codex` and `Claude Code` are replaced by
  each agent's logo mark.

Because the row would otherwise lose everything that distinguishes two sessions of the same
agent, the path line is **replaced by the session's saved project name** rather than simply
deleted.

Decisions already made with the user (do not re-litigate them):

- **Project name replaces the path.** Resolve it the way the console already resolves the
  active session's project: match a saved project by `project.path === session.cwd`. When no
  saved project matches, fall back to the last segment of the path (the directory's own name),
  never the full path.
- **Logos are inline SVG components authored in this repository.** Add an `AgentLogo`
  component with one simplified, monochrome `currentColor` mark per agent id. No brand asset
  files, no `next/image`, no network fetches, nothing added to `public/`.
- **Scope is the session sidebar only.** The agent `<select>` on the console and the two
  `<select>` elements on the settings page keep their text labels — a native `<option>` cannot
  render an image anyway. The active-session header on the right stays as it is.

## Application

Root application (`agenthub`) — single Next.js app in `src/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #12 — "http://localhost:3000/console — sol tarafta listede path görünmesin; codex ve
  claude code yerine logoları görünsün" (in the left-hand list the path should not be shown;
  logos should appear instead of "codex" and "claude code")

## Dependencies

None - This task is independent.

## Context

### Current row markup

`src/app/console/session-sidebar.tsx` renders, inside the row `<button>`:

```tsx
<span className="flex items-center gap-2 text-sm font-medium">
  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${exited ? "bg-slate-400" : "bg-emerald-500"}`} />
  <span className="truncate">{agent.label}</span>
</span>
<span className="mt-1 block truncate font-mono text-xs text-slate-500" title={session.cwd}>
  {session.cwd}
</span>
<span className="mt-1 block text-xs text-slate-500">{exited ? "Exited" : "Live"}</span>
```

`agent` comes from `getAgent(session.agent)` (`src/lib/agents.ts`), whose catalog is
`[{ id: "codex", label: "Codex" }, { id: "claude", label: "Claude Code" }]`.

### Target row

Keep the three-line shape; only the content of lines 1 and 2 changes:

| Line | Before | After |
| --- | --- | --- |
| 1 | dot + `Codex` / `Claude Code` | dot + the agent's logo mark (with a screen-reader-only label) |
| 2 | full `cwd` in monospace, `title={session.cwd}` | the project name, plain text, truncated, **no** `title` attribute |
| 3 | `Live` / `Exited` | unchanged |

### Files to change

| File | Change |
| --- | --- |
| `src/app/console/agent-logo.tsx` | **New.** `AgentLogo` client-safe component: takes `agent: AgentId` and an optional `className`, returns the inline SVG mark for that agent. |
| `src/app/console/session-sidebar.tsx` | Accept a `projects` prop, resolve each session's display name, render `<AgentLogo>` in place of `agent.label`, delete the `cwd` line. |
| `src/app/console/agent-console.tsx` | Pass the already-loaded `projects` state into `<SessionSidebar>`. |

Nothing else changes: no store, no API route, no WebSocket message shape, no `server/` file,
no `src/lib/agents.ts` change (the `label` strings stay — they remain the accessible name and
are still used by the `<select>` elements).

### Passing projects into the sidebar

`AgentConsole` already holds `const [projects, setProjects] = useState<ConsoleProject[]>([])`
and already resolves the active session's project with
`projects.find((project) => project.path === activeSession.cwd)`. Pass the same array down:

```tsx
<SessionSidebar
  sessions={sessions}
  projects={projects}
  selectedSessionId={selectedSessionId}
  ...
/>
```

Declare a minimal structural prop type inside `session-sidebar.tsx` rather than importing
`ConsoleProject` from `agent-console.tsx` (that would create a circular module reference):

```tsx
type SidebarProject = { path: string; name: string };
```

`ConsoleProject` is structurally assignable to it, so no cast is needed at the call site.

### Resolving the displayed name

```tsx
function sessionLabel(cwd: string, projects: SidebarProject[]) {
  const project = projects.find((candidate) => candidate.path === cwd);
  if (project) {
    return project.name;
  }
  return cwd.split("/").filter(Boolean).at(-1) ?? cwd;
}
```

The fallback covers sessions whose project was deleted or renamed on disk, and trailing
slashes. `projects` may be empty on first render while the console is still loading them — the
fallback handles that too, and the row re-renders with the real name once loading finishes.

### The logo marks

Author both marks by hand as simplified monochrome geometry — do not copy vendor brand files
into the repo and do not fetch anything from the network:

- **`claude`** — a radial starburst: a ring of tapered rounded rays radiating from the centre
  (the Claude mark's silhouette). Twelve rays at 30° steps reads well at 16px.
- **`codex`** — an OpenAI-style six-fold knot approximated by three identical rounded stroked
  ellipses (or rounded rects) sharing a centre and rotated 0° / 60° / 120°.

Both must:

- use `viewBox="0 0 16 16"` and `fill="none"` / `stroke="currentColor"` where stroked, matching
  the dismiss icon already in this file, so the mark inherits the row's text colour (slate for
  idle rows, `text-sky-950` for the selected row);
- carry `aria-hidden="true"` — the accessible name comes from the sibling `sr-only` span;
- accept a `className` for sizing, defaulting to nothing and being called with
  `className="h-4 w-4 shrink-0"` from the sidebar.

Suggested shape of the component:

```tsx
export function AgentLogo({ agent, className }: { agent: AgentId; className?: string }) { … }
```

Switch on `agent` and return the matching `<svg>`; the `AgentId` union makes the switch
exhaustive, so no default branch that silently renders nothing — if a new agent id is added
later, TypeScript should point at this file.

## Acceptance Criteria

- [ ] The session sidebar no longer renders `session.cwd` anywhere — neither as text nor as a
      `title` tooltip.
- [ ] Each session row shows its agent's logo mark instead of the words `Codex` /
      `Claude Code`.
- [ ] Each row's second line shows the saved project's name for that session's directory.
- [ ] A session whose `cwd` matches no saved project shows the last path segment (e.g.
      `/Users/bora/Code/foo/` → `foo`), not the full path and not an empty line.
- [ ] The logo is `aria-hidden` and every row still has an accessible agent name (an `sr-only`
      span carrying `agent.label`), so the list is still usable with a screen reader.
- [ ] The dismiss button's `aria-label` no longer contains the raw path; it names the agent and
      the project instead (e.g. `Dismiss Codex session in agenthub`).
- [ ] The selected row's logo picks up the selected row's text colour (it uses `currentColor`,
      not a hard-coded fill).
- [ ] Long project names still truncate inside the fixed `17rem` sidebar column; the row does
      not grow wider than the column or wrap onto extra lines.
- [ ] `src/app/console/agent-logo.tsx` contains hand-authored inline SVG only — no imported
      image files, nothing new under `public/`, no runtime fetch.
- [ ] The agent `<select>` on the console and both `<select>` elements on
      `src/app/settings/settings-form.tsx` are unchanged and still show text labels.
- [ ] `.agent/PROJECT_DOCUMENT.md` — no change is required by this task; only update it if the
      repository-structure listing ends up inaccurate after adding `agent-logo.tsx`.

## Technical Notes

- `session-sidebar.tsx` is already `"use client"`; `agent-logo.tsx` renders no state or
  effects, so it needs no `"use client"` directive of its own — it will be pulled into the
  client bundle by its importer. Do not add one unnecessarily.
- Keep the `<span className="flex items-center gap-2 text-sm font-medium">` wrapper for line 1;
  the state dot stays exactly as it is, including its `aria-hidden`.
- Remove `font-mono` along with the path — the project name is prose, not a path.
- Tailwind v4 ships `sr-only`; use it rather than hand-rolling a visually-hidden class.
- Do not memoise `sessionLabel` with `useMemo`/`useCallback`: the project list is tiny and the
  React Compiler (`babel-plugin-react-compiler`, already enabled) handles this. Match the
  file's existing plain-function style.
- Do not change `SessionSummary` in `src/lib/agent-protocol.ts`. `cwd` stays on the wire and
  stays in use on the right-hand session header and in the start message — only the sidebar
  stops displaying it.
- These are the project's existing type-safety conventions — no `any`, no non-null assertions,
  no `dangerouslySetInnerHTML` for the SVGs.
- Respect the project's 600-line-per-file guideline; all touched files stay well under it.
- The installed Next.js is newer than most training data — consult
  `node_modules/next/dist/docs/` before writing any Next.js-specific code (see AGENTS.md).

## Verification

- Ensure the verification steps in `.agent/PROJECT_DOCUMENT.md` are performed.
- `pnpm build` completes with no compilation or type errors.
- `pnpm lint` passes; fix any errors it reports.
- Run `pnpm dev`, open `http://localhost:3000/console` and check:
  - Start a Codex session and a Claude Code session in the **same** project → the two rows show
    different logos and the same project name; no path is visible anywhere in the sidebar.
  - Start sessions in **two different** saved projects → the rows are distinguishable by name.
  - Select a row → its logo changes colour with the rest of the selected row's text.
  - Stop a session → the row shows `Exited`, a grey dot, and the dismiss (×) button; hovering
    the × exposes an aria-label naming the agent and project, with no path in it.
  - Hover the project name → no path tooltip appears.
  - Zoom the browser / pick a project with a long name → the name truncates with an ellipsis
    and the sidebar column keeps its width.
- There are no automated tests in this project; the manual walkthrough above is the test.
