# Add a shared, clickable AgentHub brand header to every page

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

Make the **AgentHub** wordmark a link back to the home page (`/`), and show it on **every**
page of the app.

Today the string "AgentHub" is rendered as a plain, unclickable `<h1>` on exactly two pages
(the projects home page and the console). The other three pages — Settings, New project and
Project detail — carry no brand title at all; they only have a small "Projects" back-link.

After this task, every page starts with the same clickable **AgentHub** wordmark that
navigates to `/`, with that page's own title underneath it.

Decisions already made with the user (do not re-litigate them):

- The wordmark is extracted into **one shared component** and reused by all pages — it is not
  copy-pasted per page.
- The wordmark is a link on **every** page, **including the home page itself** (a self-link
  to `/`). One code path, no per-page special case.
- The existing "Projects" back-link on Settings / New project / Project detail **stays as it
  is**. It is not removed and not replaced by the wordmark.

## Application

Root application (`agenthub`) — single Next.js app in `src/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #7 — "agenthub başlığına tıklandığında ana sayfaya gitsin" (clicking the AgentHub
  title should go to the home page; on every page)

## Dependencies

None - This task is independent.

## Context

### Where the brand is rendered today

| File | Current state |
| --- | --- |
| `src/app/page.tsx` (line ~62) | `<h1 …>AgentHub</h1>` inside the page `<header>`, with a subtitle and a Settings / Open console / New project button row |
| `src/app/agent-console.tsx` (line ~222) | `<h1 …>AgentHub</h1>` inside the console `<header>`, with a subtitle and a "Projects" link + connection indicator |
| `src/app/settings/page.tsx` | No brand. `<header>` = "Projects" link, then `<h1>Settings</h1>` + subtitle |
| `src/app/projects/new/page.tsx` | No brand. `<header>` = "Projects" link, then `<h1>New project</h1>` + subtitle |
| `src/app/projects/[id]/project-detail.tsx` (line ~97) | No brand. `<header>` = "Projects" link, then `<h1>{project.name}</h1>` + subtitle, plus an "Open console" button |
| `src/app/projects/[id]/page.tsx` (error branch, line ~22) | No brand and no `<header>` — just a "Projects" link above an error alert |

`src/app/layout.tsx` only sets fonts, `metadata.title` and the `<body>` shell. It renders no
visible chrome today.

### Page-title relationship

Two of the pages currently use "AgentHub" **as** their page `<h1>`; the other three have a
different `<h1>` (Settings / New project / project name). After this task the wordmark sits
above the page title on all pages, so the home page and the console each need a real page
title of their own where the wordmark used to be. Keep their existing subtitles:

- Home (`page.tsx`): subtitle "Keep your local coding projects ready for an agent session."
- Console (`agent-console.tsx`): subtitle "Keep one {taskAgentLabel} conversation open in the
  directory you choose."

Give each a short, descriptive `<h1>` consistent with the rest of the app (e.g. "Projects" for
the home page, "Console" for the console page) — pick names that match the wording already
used in the app's navigation links.

### Layout vs. per-page

Two implementation shapes are possible. Prefer the **shared component** shape:

- **Shared component (preferred)** — a small `BrandLink` / `AppHeader` component rendered by
  each page's existing `<header>`. Every page keeps full control of its own header layout
  (the home page's button row, the console's connection indicator, the detail page's "Open
  console" button), which those headers currently rely on.
- Putting it in `src/app/layout.tsx` would apply it globally, but the pages' headers differ
  enough in layout and content that this would force a rewrite of all five headers. Do not do
  this unless the shared-component route turns out to be unworkable.

The console (`agent-console.tsx`) is a `"use client"` component; the shared component must be
safe to render from both server and client components — keep it a plain presentational
component with no hooks, no `"use client"` directive of its own, and no data fetching.

### Related in-flight work

`.agent/tasks/github6_add-claude-code-agent-and-multi-session-console.md` also touches
`src/app/agent-console.tsx` and reworks the console into a multi-session layout. This task is
independent of it, but if that task has already been executed, apply the wordmark to whatever
the console header looks like at that point rather than to the header described above.

## Acceptance Criteria

- [ ] A single shared brand component exists (e.g. `src/app/brand-link.tsx` or
      `src/components/…` following the existing project layout) that renders the text
      "AgentHub" wrapped in a `next/link` `<Link href="/">`.
- [ ] The component is rendered by all five page surfaces: home, console, settings, new
      project, project detail — and by the project-detail error branch in
      `src/app/projects/[id]/page.tsx`.
- [ ] Clicking the wordmark on any page navigates to `/`.
- [ ] The wordmark is a link on the home page too (self-link); no per-page conditional.
- [ ] Home and console pages each keep a page `<h1>` of their own below the wordmark, and
      their existing subtitles are preserved.
- [ ] Exactly one `<h1>` remains per page (the page title). The wordmark must not be a second
      `<h1>`.
- [ ] The existing "Projects" back-link on Settings, New project and Project detail is left in
      place, unchanged.
- [ ] The wordmark has a visible hover state and a visible keyboard-focus ring, matching the
      focus-ring conventions already used across the app.
- [ ] No copy-pasted duplicate of the wordmark markup remains in any page file.

## Technical Notes

- Use `next/link`'s `<Link href="/">`; do not use a bare `<a href="/">` (it would trigger a
  full page reload and `eslint-config-next` flags it).
- Follow the existing Tailwind conventions in these files: `transition hover:…` for hover, and
  `focus:outline-none focus:ring-3 focus:ring-sky-100` for focus rings (see
  `src/app/settings/page.tsx` lines 31–36 for the exact pattern in use).
- Heading semantics: currently the brand is the `<h1>` on home/console. After the change the
  page title is the `<h1>`. Render the wordmark as a plain element (e.g. a `<Link>` styled as
  a wordmark, or wrapped in a `<div>`/`<p>`) so heading levels stay sane and there is no
  duplicate `<h1>`.
- The wordmark should be visually smaller than the page `<h1>` so the page title stays the
  dominant element — the existing "Projects" back-links (`text-sm font-medium`) are the size
  reference for secondary header text; the wordmark may be slightly stronger than that, but
  must not compete with the `text-3xl` page title.
- Do not change `metadata.title` in `src/app/layout.tsx`; the browser-tab title stays
  "AgentHub".
- `src/app/agent-console.tsx` is a client component — importing a server-safe presentational
  component into it is fine, but do not import anything that reads the filesystem or the
  settings store into the shared component.
- Keep the change presentational. Do not touch routing, the WebSocket protocol, the session
  registry, or any store under `src/lib/`.
- Respect the project's 600-line-per-file guideline; the new component is small and none of
  the touched files should grow meaningfully.

## Verification

- `pnpm build` completes with no compilation or type errors.
- `pnpm lint` passes; fix any errors it reports (in particular `@next/next/no-html-link-for-pages`).
- Run `pnpm dev` and manually confirm on each route that the AgentHub wordmark is visible and
  navigates to `/` when clicked:
  - `/`
  - `/console`
  - `/settings`
  - `/projects/new`
  - `/projects/{id}` for an existing project (create one first if `data/projects.json` is empty)
- Tab to the wordmark with the keyboard on at least one page and confirm the focus ring is
  visible.
- There are no automated tests in this project; manual verification above is the test.
