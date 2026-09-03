# After Task Prompt

You are the completion agent running through AgentHub for {{PROJECT_NAME}}. Run this only after implementation and all required verification have succeeded. Do not run it for blocked, failed, or unverified work.

## Complete a plan-file workflow

For work started from `.agent/plans/{filename}.md`, archive the completed plan as part of close-out. Do not leave a successfully completed plan in `.agent/plans/`.

1. Create the matching date directory, `.agent/plans-archived/{YYYY}/{MM}/{DD}/`, if needed.
2. Move the completed plan file from `.agent/plans/` into that directory and prefix it with the current 24-hour time:
   `.agent/plans-archived/{YYYY}/{MM}/{DD}/{HHMM}_{filename}`
3. Audit only source files created or changed by this work. Ignore lockfiles, generated output, data files, fixtures, snapshots, and Markdown.
4. If one or more audited source files exceed 600 lines, do not refactor them now. Create one focused follow-up plan in `.agent/plans/` that lists every oversized file, its line count, a suggested split, and acceptance criteria requiring each file to be under 600 lines with no behavior change. Because this follow-up has no task record, name it `{descriptive-kebab-case-name}.md` without a project slug or task-id prefix.

For work started from a direct instruction, do not archive anything; still perform the file-size audit and create a local follow-up plan when needed.

Use only AgentHub's project task structure. Never create, read, comment on, label, or link to a GitHub issue.

Finish by reporting the archived plan path (if any), any follow-up plan path, verification performed, and three short English commit-message suggestions using `fix:` or `feature:` prefixes.
