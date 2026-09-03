# Write plan output in the language of the task

## Description

Plans must be produced in the same language the task was written in. Today the planning flow
hard-codes English: the built-in *Task planning prompt* says "Write the task in English" and the
built-in *After planning prompt* verifies "it is written in English", so a Turkish task still
yields an English task file, plan title, and plan summary.

Add a **code-defined** language rule to the composed planning prompt in `src/lib/task-plan.ts`.
The rule instructs the planning agent to infer the language from the task title and detail that
the same prompt already carries, and to write the plan in that language — the task-file prose,
the registered plan title, and the registered plan summary. If the task text explicitly asks for
another language, that explicit request wins.

The rule lives in code (not in the four editable settings prompts) so it applies to every planning
session even when a user replaces the saved *Task planning* / *After planning* prompt text. The
two built-in Markdown defaults are updated in the same change so they no longer contradict it.

Scope is the planning flow only. The task-execution flow (`src/lib/task-run.ts`,
`src/lib/default-prompts/task.md`, `src/lib/default-prompts/task-post.md`) is deliberately left
unchanged.

## Application

Root application (`agenthub`)

## Dependencies

None - This task is independent

## Context

Relevant existing pieces:

- `src/lib/task-plan.ts` — client-safe prompt composer. `composePlanPrompt(options)` joins
  sections with `\n\n---\n\n` in this order: the effective plan prompt, a
  `## Task #{id}: {title}` section carrying the task detail, the effective after-planning prompt,
  and — when `plansEndpoint` is provided — the code-defined `## Register the plan in AgentHub`
  section built by the local `registerPlanPrompt(...)` helper. That helper is the existing
  precedent for a section that is defined in code rather than in settings.
- `src/app/api/projects/[id]/tasks/[taskId]/plan-prompt/route.ts` — resolves project, task, and
  settings, falls back to the built-in Markdown prompt when a saved prompt is empty
  (`effectivePrompt`), and returns `{ agent, projectId, projectName, projectPath, taskId, prompt }`
  where `prompt` is the `composePlanPrompt(...)` result. This is the only caller of
  `composePlanPrompt`.
- `src/app/console/use-plan-run.ts` — fetches that endpoint and starts the console session with
  the composed prompt as the agent's first message; it does not modify the prompt text.
- `src/lib/default-prompts/plan.md` line 7 — "Write the task in English under
  `.agent/tasks/{descriptive-kebab-case-name}.md`. …".
- `src/lib/default-prompts/plan-post.md` line 6 — "Confirm it is written in English, has a focused
  scope, …".
- `src/lib/default-settings-prompts.ts` — server-only reader for those Markdown defaults; the
  settings screens display them as muted placeholder text when no prompt is saved, so edits to the
  two files are also visible in `/settings`.
- `.agent/PROJECT_DOCUMENT.md` line 164 — "Task files are always written in English."

Two structural constraints the rule must respect, because other parts of the workflow parse or
reuse the task file:

- The task template's section headings (`## Description`, `## Application`, `## Dependencies`,
  `## Context`, `## Acceptance Criteria`, `## Technical Notes`, `## Verification`) and the
  `Root application (`agenthub`)` line stay in English; only the prose written under them follows
  the task's language. The after-planning prompt checks for those exact headings, and the
  execution flow reads the same file.
- The task file name stays lowercase ASCII kebab-case English (`{descriptive-kebab-case-name}.md`),
  as do commands, file paths, code identifiers, and the `curl` registration snippet.

## Acceptance Criteria

- [ ] `src/lib/task-plan.ts` defines the language rule in code and `composePlanPrompt` always
      includes it as its own `\n\n---\n\n`-separated section, positioned immediately after the
      `## Task #{id}: {title}` section so it sits next to the text whose language it refers to.
- [ ] The section is emitted for every composed planning prompt, including when `plansEndpoint` is
      omitted, and it is not conditional on any setting.
- [ ] The section states that the plan is written in the same language as the task title and
      detail above it, that the agent infers that language from that text, and that an explicit
      language request inside the task text overrides the inferred language.
- [ ] The section names the three outputs covered: the task file's prose, the plan title, and the
      plan summary sent to `POST /api/plans`.
- [ ] The section states that Markdown section headings, the `Root application (`agenthub`)` line,
      the kebab-case English file name, file paths, commands, and code identifiers stay in English
      regardless of the task's language.
- [ ] `src/lib/default-prompts/plan.md` no longer requires English; step 3 instead points at the
      prompt's language rule while keeping the `.agent/tasks/{descriptive-kebab-case-name}.md`
      path and the "no GitHub issues" instruction unchanged.
- [ ] `src/lib/default-prompts/plan-post.md` step 2 no longer checks for English; it instead checks
      that the task file matches the task's language (or the explicitly requested one) while
      keeping the rest of that step's checks — focused scope, root `agenthub` application, and the
      required sections — unchanged.
- [ ] `src/lib/task-run.ts`, `src/lib/default-prompts/task.md`, and
      `src/lib/default-prompts/task-post.md` are unchanged.
- [ ] `GET /api/projects/{projectId}/tasks/{taskId}/plan-prompt` returns the same response shape as
      today, with the language section present in `prompt`; no route signature, field, or error
      message changes.
- [ ] `src/lib/task-plan.ts` stays client-safe (no `server-only` import, no Node built-ins) and
      under 600 lines.
- [ ] `.agent/PROJECT_DOCUMENT.md` is updated: line 164's "Task files are always written in
      English." is replaced with the new rule, and the planning-flow description notes that the
      composed planning prompt carries a code-defined language rule.

## Technical Notes

- Read `.agent/PROJECT_DOCUMENT.md` before implementing.
- Suggested shape in `src/lib/task-plan.ts`, mirroring the existing `registerPlanPrompt` helper:

  ```ts
  const PLAN_LANGUAGE_SECTION = [
    "## Plan language",
    "Write the plan in the same language as the task title and detail above; infer that language from that text.",
    "This covers the task file's prose, the plan title, and the plan summary registered with AgentHub.",
    "If the task text explicitly asks for another language, use the requested language instead.",
    "Regardless of language, keep the Markdown section headings, the `Root application (`agenthub`)` line, the lowercase kebab-case English file name, file paths, commands, and code identifiers in English.",
  ].join("\n\n");
  ```

  then push it into `sections` between the task section and `options.planPostPrompt`.
- Keep the wording in English: it instructs the agent about which language to produce, and the
  surrounding prompt is English.
- Do not add a settings field, a store field, or a UI control for the language — the rule is not
  configurable in this task.
- Do not attempt language detection in TypeScript; the agent infers the language from the prompt.
- Do not change `composePlanPrompt`'s options type or `planConsoleHref`.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual: create a task whose title and detail are written in Turkish, open its detail page,
      and confirm `curl -s "http://localhost:3000/api/projects/{projectId}/tasks/{taskId}/plan-prompt"`
      returns a `prompt` containing the `## Plan language` section directly after the
      `## Task #{id}` section.
- [ ] Manual: click **Create plan** on that Turkish task and confirm the planning session writes
      the task file's prose, the registered plan title, and the plan summary in Turkish, while the
      section headings, file name, and commands stay English.
- [ ] Manual: repeat with an English task and confirm the produced plan is English.
- [ ] Manual: open `/settings`, confirm the muted built-in *Task planning prompt* and *After
      planning prompt* placeholders show the updated wording, and confirm a saved (custom) plan
      prompt still produces a composed prompt that contains the `## Plan language` section.
