# Remove Inert `turbopackIgnore` Comments from `plan-file.ts`

## Description

`src/lib/plan-file.ts` passes a `/* turbopackIgnore: true */` magic comment as the
first argument of four Node `fs` calls (`fs.stat`, `fs.readFile`, `fs.lstat`,
`fs.unlink`). This magic comment is only interpreted by the bundler on dynamic
`import()`, `require()`, `require.resolve()`, and `new Worker()` expressions, so on
plain `fs` method calls it is inert: it changes neither the build nor the runtime
behaviour. Remove the four comments so the module reads like the rest of the
codebase's filesystem helpers.

## Application

Root application (`agenthub`)

## Dependencies

None - This task is independent

## Context

- File: `src/lib/plan-file.ts` (server-only module, `import "server-only"`).
- The comments were introduced together with the plan CRUD feature (commit `205cfcb`,
  "feature: add plan CRUD") and appear nowhere else in the repository.
- Authoritative reference in the installed Next.js version (16.3.4):
  - `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` — "Magic Comments":
    "These comments work with dynamic `import()`, `require()`, `require.resolve()`, and
    `new Worker()` expressions."
  - `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md` — table listing
    `turbopackIgnore: true` as "Skip bundling (Turbopack-only)" for those same expressions.
- Precedent in the same codebase: `src/lib/projects-store.ts:110` calls
  `fs.stat(projectPath)` with a fully dynamic path and no magic comment, and
  `src/lib/plans-store.ts`, `src/lib/tasks-store.ts`, and `src/lib/settings-store.ts`
  do the same for `readFile` / `writeFile` / `mkdir`. The build succeeds today with
  those call sites, which is the practical evidence that the comments in
  `plan-file.ts` are not load-bearing.
- No behaviour change is intended: path validation stays in `resolvePlanFilePath`, and
  the `not-found` / `too-large` / `invalid-path` / `error` result shapes stay identical.

## Acceptance Criteria

- [ ] `grep -rn "turbopackIgnore" src/` returns no matches.
- [ ] The four call sites in `src/lib/plan-file.ts` read as plain calls:
      `fs.stat(resolvedFilePath)`, `fs.readFile(resolvedFilePath, "utf8")`,
      `fs.lstat(resolvedFilePath)`, `fs.unlink(resolvedFilePath)`.
- [ ] No other change is made to `src/lib/plan-file.ts`: the exported signatures of
      `resolvePlanFilePath`, `readPlanFile`, and `deletePlanFile`, the
      `PLAN_FILE_PREVIEW_MAX_BYTES` limit, and every returned status value are unchanged.
- [ ] No other file in the repository is modified.

## Technical Notes

- Read `.agent/PROJECT_DOCUMENT.md` before implementing.
- This is a comment-only deletion; do not "improve" the surrounding error handling,
  rename anything, or reorder the `stat` / size-check logic.
- If `pnpm build` unexpectedly fails with a bundler resolution or "the request of a
  dependency is an expression" style warning pointing at `src/lib/plan-file.ts`, do not
  reinstate the comments silently. Record the exact message in the archived task notes
  and report it, because such a failure would contradict the documented magic-comment
  scope and needs a different fix (for example marking the module external).

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual check with `pnpm dev`: open a plan detail page whose `filePath` points at an
      existing Markdown file under the project path and confirm the preview still renders.
- [ ] Manual check: open a plan whose `filePath` points at a missing file and confirm the
      "not found" state still renders instead of an error.
- [ ] Manual check: delete a plan through `DELETE /api/plans/{planId}?file=delete` and
      confirm the Markdown file is removed from disk and the response reports the deletion.
