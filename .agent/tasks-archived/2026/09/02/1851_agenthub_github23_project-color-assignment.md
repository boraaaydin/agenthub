# Assign a color to every project and show it wherever the project is named

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

Every saved project gets a color. The color is picked on the project detail page from a fixed
palette of swatches, and it is used everywhere a project is named as a chip: the task list, the
task detail page, the project list, the plan list, and — if that page exists by the time this task
runs — the plan detail page.

The colored surface is **only the project-name chip**: the project name is rendered white on the
project's color. Nothing else on those pages changes color.

Decisions already made with the user (do not re-litigate them):

- **Preset palette, not a free hex picker.** The picker is a row of clickable swatches from a
  fixed palette. The stored value is a palette **token name** (e.g. `"sky"`), never a raw hex
  string. This keeps white text readable on every possible choice and keeps the classes static,
  which Tailwind v4 requires.
- **Existing projects are colored automatically.** A project record with no stored color derives a
  stable color from its `id`, so every project is colored the moment this ships and
  `data/projects.json` needs no migration. Picking a color explicitly overrides the derived one.
- **The picker is on both `/projects/{id}` and `/projects/new`.** A project can be colored at
  creation time and recolored later.
- **Chips only; large headings stay plain.** The project detail `<h1>` and any page title keep
  their current styling. The color appears in the inline project-name chips listed above.
- **A live preview is part of the picker.** Selecting a swatch immediately previews the chip
  exactly as it renders in the lists, using the same component the lists use — not a hand-rolled
  copy of its markup.

## Application

Root application (this repository is a single Next.js app; there is no `apps/` directory).

## GitHub Issue

- Issue #23

The issue is written in Turkish: a color picker on the project detail page; when a color is
selected, preview it the way it looks everywhere else; only the project-name part is colored as a
background with the name in white; each project shows in its own color on the task list, the task
detail page, the project list, the plan list, and the plan detail page if one exists.

## Dependencies

None - This task is independent.

Note on `/plans/{planId}`: the plan detail page is the subject of the separate task
`github22_plan-detail-page-and-crud.md` (issue #22), which is being implemented in parallel. This
task does **not** depend on it and must **not** create, complete, or modify the behaviour of that
page. See the conditional acceptance criterion below: if `src/app/plans/[planId]/page.tsx` exists
when this task runs, its project chip is colored like every other; if it does not exist, that
criterion is skipped and noted as skipped.

## Context

Relevant files, all of which already exist:

- `src/lib/projects-store.ts` (server-only, ~180 lines) — `Project = { id, name, path, createdAt }`
  persisted as `{ "projects": [...] }` in `data/projects.json`. `isProject` type-guards each
  record on read and `parseDocument` throws `ProjectStoreError` when any record fails the guard —
  **so the guard must keep accepting records without a color**. `projectDetails(input)` validates
  and normalizes `{ name, path }` and is shared by `createProject` and `updateProject`;
  `ProjectValidationError` is what a bad field throws. Writes go through `serializeWrite`.
- `src/app/projects/[id]/project-detail.tsx` (`"use client"`, 279 lines) — the edit form. It
  PATCHes `/api/projects/{id}` with `{ name, path }`, seeds local state from props, has
  `resetForm()`, a status/error panel pair, and a delete section. The `<h1>` at line ~114 is the
  heading that stays plain.
- `src/app/projects/new/page.tsx` (`"use client"`, 129 lines) — the creation form; POSTs
  `{ name, path }` to `/api/projects` and `router.replace("/projects")`.
- `src/app/projects/page.tsx` — list rows render the name as
  `<h2 className="font-medium text-slate-900">{project.name}</h2>`.
- `src/app/tasks/page.tsx` — `TaskRows` receives `projectNames: Map<string, string>` and renders
  the chip as `<span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium
  text-slate-600">{projectName ?? "Unknown project"}</span>`. The map is built in the page body
  from `listProjects()`.
- `src/app/plans/page.tsx` — `PlanRows` has the identical `projectNames` map and the identical
  neutral chip markup.
- `src/app/projects/[id]/tasks/[taskId]/page.tsx` — passes `projectName={project.name}` into
  `TaskDetail`.
- `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx` (`"use client"`) — renders the breadcrumb
  `<Link href={taskListPath}>{projectName} tasks</Link>` at line ~150.
- `src/app/api/projects/route.ts` and `src/app/api/projects/[id]/route.ts` — both pass the parsed
  JSON body straight into the store, so **no new field handling is needed in the Route Handlers**;
  validation belongs in `projectDetails`.
- `src/lib/task-filters.ts` / `src/lib/plan-filters.ts` — the pattern for a client-safe helper
  module that never imports a store. The new color module follows it.

Tailwind CSS v4 only emits classes it can see as complete literal strings in the source. A class
built at runtime (`` `bg-${token}-700` ``) will not exist in the stylesheet. Every color class in
this task must appear as a full literal in the palette table.

Next.js here is 16.3.4 — newer than most training data. Read the relevant guide under
`node_modules/next/dist/docs/` before touching routing or Route Handler signatures, and keep the
existing typed `PageProps<…>` / `RouteContext<…>` helpers.

## Acceptance Criteria

### Palette module (`src/lib/project-colors.ts`, new, client-safe)

- [ ] The module imports nothing from any store and is safe to import from both server components
      and `"use client"` components (same rule as `src/lib/task-filters.ts`).
- [ ] It exports a `PROJECT_COLORS` array of at least 10 entries, each
      `{ token, label, chipClass, swatchClass }`:
      - `token` — the stored value, a short lowercase name (`"slate"`, `"sky"`, …);
      - `label` — the human name used for the swatch's accessible label;
      - `chipClass` — the literal background+text classes for the chip, using the Tailwind **700**
        shade with white text (e.g. `"bg-sky-700 text-white"`). The 700 shade is required: it
        clears 4.5:1 against white for every hue, which the 500/600 shades do not.
      - `swatchClass` — the literal background class for the picker button (e.g. `"bg-sky-700"`).
- [ ] Suggested tokens (any set of ≥10 distinguishable hues is acceptable, all at the 700 shade):
      `slate`, `red`, `orange`, `amber`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`,
      `violet`, `fuchsia`, `rose`.
- [ ] `ProjectColorToken` is a union type derived from the palette, not a bare `string`.
- [ ] `isProjectColorToken(value: unknown): value is ProjectColorToken`.
- [ ] `fallbackProjectColor(projectId: string): ProjectColorToken` — a pure, deterministic hash of
      the id into the palette (a simple character-code fold is enough). The same id always yields
      the same token, on the server and on the client, so a server-rendered chip and a client
      re-render never disagree.
- [ ] `projectColorToken(projectId: string, color?: string | null): ProjectColorToken` — returns
      the stored token when it is a valid palette token, otherwise `fallbackProjectColor(projectId)`.
- [ ] `projectChipClass(token: ProjectColorToken): string` — the chip classes for a token.

### Shared chip component (`src/app/project-chip.tsx`, new)

- [ ] A small presentational component, no `"use client"` directive and no store import, so it can
      be rendered from server components *and* pulled into the client bundle by the client
      components that use it.
- [ ] Props: `{ projectId: string; name: string; color?: string | null; className?: string }`.
- [ ] Renders a single `<span>` with the existing chip geometry
      (`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium`) plus the color classes resolved
      through `projectColorToken`, so the name is white on the project's color.
- [ ] A separate exported `UnknownProjectChip` (or an explicit prop path) keeps today's neutral
      look — `bg-slate-100 text-slate-600` with the text "Unknown project" — for rows whose project
      record is gone. A missing project is **not** given a color.
- [ ] Every chip site below uses this component. No page hand-writes the colored chip markup.

### Store (`src/lib/projects-store.ts`)

- [ ] `Project` gains `color?: ProjectColorToken`.
- [ ] `isProject` still accepts a record with **no** `color` key, and accepts one whose `color` is a
      valid palette token. An unrecognised `color` value must not make the whole document fail to
      parse — normalize it away on read (drop it / treat the project as uncolored) rather than
      throwing `ProjectStoreError`, so a hand-edited `data/projects.json` cannot brick the app.
- [ ] `projectDetails(input)` also validates `color`:
      - absent or `undefined` → the field is not part of the result;
      - `null` or `""` → an explicit clear, so the project falls back to its derived color;
      - a valid palette token → kept;
      - anything else → `ProjectValidationError("Choose a color from the palette.")`.
- [ ] `createProject` stores the color when one was supplied and omits the key otherwise.
- [ ] `updateProject` sets the color when one was supplied, deletes the stored key on an explicit
      clear, and **leaves the stored color untouched when the field is absent from the patch** —
      an older client that PATCHes only `{ name, path }` must not wipe the color.
- [ ] No other store gains a color field; the color lives only on the project record.

### Project detail page (`/projects/{id}`)

- [ ] The edit form gains a "Project color" section between the working directory field and the
      submit row.
- [ ] The palette renders as a wrapping row of swatch buttons (`type="button"`), each filled with
      its `swatchClass`, each with an accessible name (the palette `label`), and the selected one
      visibly marked — a ring plus `aria-pressed="true"` (or a radio group; either is fine as long
      as it is keyboard-reachable and announces the selection).
- [ ] Selecting a swatch updates local state only. It is persisted by the existing "Save changes"
      button, which now PATCHes `{ name, path, color }`. "Cancel" restores the loaded color along
      with the other fields.
- [ ] A live preview sits under the swatches and renders the **actual `ProjectChip`** with the
      currently selected color and the current value of the name input, inside a mock list row that
      resembles a task row (chip, a status pill, `#12`, a title) so the user sees the chip in the
      context it appears in. The preview updates as the name is typed and as a swatch is clicked.
- [ ] The page `<h1>` keeps its current plain styling.
- [ ] `project-detail.tsx` stays under the project's 600-line rule. Extract the picker into a
      shared `"use client"` component — `src/app/projects/project-color-picker.tsx` — that both this
      page and `/projects/new` render, rather than duplicating swatch markup in two files.

### New project page (`/projects/new`)

- [ ] The same `ProjectColorPicker` appears in the creation form, with a fixed default token
      preselected (do **not** randomize the default at render time — that desynchronizes server and
      client HTML).
- [ ] The form POSTs `{ name, path, color }`; the created project is stored with that color.
- [ ] The preview works the same way as on the detail page.

### Project list (`/projects`)

- [ ] Each row's project name renders as its colored chip. Keep the `<h2>` element for structure
      and put the chip inside it, so the row still exposes a heading while the visible label is the
      colored chip.
- [ ] The working-directory line, the tasks icon link and the row link targets are unchanged.

### Task list (`/tasks`)

- [ ] The neutral project chip becomes the colored `ProjectChip`. The status pill, the `#id`, the
      title and the row layout are unchanged.
- [ ] The page passes the color through: replace the `projectNames: Map<string, string>` with a map
      to `{ name, color }` (keep the variable name or rename it consistently), built from the same
      single `listProjects()` call — do not add a second read of the store and do not fetch per row.
- [ ] A task whose project is missing still renders the neutral "Unknown project" chip and keeps
      today's non-linked row behaviour.

### Task detail page (`/projects/{id}/tasks/{taskId}`)

- [ ] `page.tsx` passes the project's color alongside its name into `TaskDetail`.
- [ ] The breadcrumb renders the colored chip in place of the bare project name — the link content
      becomes the chip followed by the word "tasks" — and still navigates to
      `/tasks?project={projectId}`. The `Task #{id}` text and the status pill are unchanged.

### Plan list (`/plans`)

- [ ] `PlanRows` uses the colored `ProjectChip`, with the same map change as `/tasks`. The
      "Unknown project" case keeps the neutral chip.

### Plan detail page (`/plans/{planId}`) — conditional

- [ ] **Check first**: if `src/app/plans/[planId]/page.tsx` exists, its project-name chip uses the
      colored `ProjectChip` too, and the page passes the project's color into its detail component.
      Change only the chip's color source; do not alter that page's data loading, form, file
      preview, or delete flow.
- [ ] If that file does not exist, skip this criterion entirely — do **not** create the page — and
      say so explicitly in the completion report.

### Documentation

- [ ] `.agent/PROJECT_DOCUMENT.md` is updated:
      - the Architecture persistence paragraph notes that a project record carries an optional
        palette color token, that a record without one derives a stable color from its id, and that
        the color is shown as a white-on-color chip wherever a project is named;
      - Repository Structure gains `src/lib/project-colors.ts`, `src/app/project-chip.tsx` and
        `src/app/projects/project-color-picker.tsx`;
      - "Delivered session capabilities" records that projects are color-coded across the project,
        task and plan screens, with the color chosen from a palette on the project create and detail
        forms.

## Technical Notes

- **Tailwind v4 needs literal classes.** Never compose a class name at runtime. The palette table
  holds `"bg-sky-700 text-white"` as a complete string; the code only ever selects an entry from
  that table.
- **Contrast is the reason for the 700 shade.** Warm hues at 500/600 (amber, orange, lime) fail
  4.5:1 against white text. Keep every palette entry on 700 rather than mixing shades per hue.
- **Determinism over randomness.** `fallbackProjectColor` must be a pure function of the id.
  Nothing in this feature may use `Math.random()` or `Date.now()` during render; a client component
  that picks a different color than the server rendered will produce a hydration mismatch.
- **The chip is one component.** Five call sites render this chip. If the geometry lives in five
  template strings, the next change touches five files — put it in `ProjectChip` and import it.
- **Do not color the `<select>` filters** on `/tasks` and `/plans`. Native `<option>` styling is
  unreliable across browsers, and the issue does not ask for it.
- **The API routes need no changes.** `POST /api/projects` and `PATCH /api/projects/{id}` already
  forward the whole JSON body into the store; the color is validated in `projectDetails` with the
  other fields, and an invalid token comes back as the usual 400.
- **Backward compatibility is load-bearing.** `parseDocument` throws on any record that fails
  `isProject`, and that error is surfaced as "Project data could not be read" on several pages. Test
  the read path against a `data/projects.json` whose records have no `color` key before considering
  the store done.
- Follow the existing visual language: `h-11 rounded-xl` controls, `border-slate-300`,
  `focus:ring-3 focus:ring-sky-100`, sky-700 primaries, `rounded-md px-2 py-0.5 text-xs` chips,
  `rounded-xl border border-slate-200 bg-white shadow-sm` sections.
- Server components on these routes are `export const dynamic = "force-dynamic"` — keep that.
- Do not touch the settings store, the prompt pages, the console session flow, `data/tasks.json`,
  or `data/plans.json`. This task changes one field on one record type plus its presentation.
- A parallel session may be editing `src/app/plans/` for issue #22. Re-read any file under
  `src/app/plans/` immediately before editing it, and keep the edits here limited to the chip.

## Verification

- `pnpm build` completes with no compilation or type errors.
- `pnpm lint` passes with no new errors or warnings.
- Manual checks with `pnpm dev` at `http://localhost:3000`:
  - `/projects` shows every existing project with a colored chip **before** any color is picked,
    each project a stable color across reloads;
  - `/projects/new` creates a project with a chosen swatch; the new project shows that color on
    `/projects`;
  - on `/projects/{id}`, clicking a swatch updates the preview instantly, typing in the name field
    updates the preview text, "Cancel" restores the loaded color, and "Save changes" persists it —
    confirm the token landed in `data/projects.json`;
  - the same project's color appears on `/tasks`, on `/projects/{id}/tasks/{taskId}`, on `/plans`,
    and — only if the page exists — on `/plans/{planId}`;
  - a task or plan row whose project was deleted still renders the neutral "Unknown project" chip
    and the page does not error;
  - `PATCH /api/projects/{id}` with `{"name":"x","path":"…","color":"not-a-color"}` returns 400 and
    leaves the stored color unchanged; the same request without a `color` key returns 200 and keeps
    the stored color;
  - a project record hand-stripped of its `color` key in `data/projects.json` still loads every
    page and falls back to its derived color.
