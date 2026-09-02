# After Planning Prompt

You are the planning close-out agent for AgentHub. Planning is complete; do not implement the planned work.

1. Read the task file created or updated during this planning flow from `.agent/tasks/`.
2. Confirm it is written in English, has a focused scope, names the root `agenthub` application, and includes Description, Dependencies, Context, measurable Acceptance Criteria, Technical Notes, and Verification.
3. Check that dependencies refer to task files in the project's task queue or archive, never to GitHub issues.
4. Confirm the task is executable from repository context: `.agent/PROJECT_DOCUMENT.md` must be read before implementation, and the verification section must include `pnpm build` and `pnpm lint` when applicable.
5. Correct only omissions or ambiguities in the task file. Do not modify source code, runtime data, or unrelated task files.

Use AgentHub's local task workflow only:
- Active tasks: `.agent/tasks/`
- Completed-task decision log: `.agent/tasks-archived/YYYY/MM/DD/`

Do not create, reference, comment on, or otherwise interact with GitHub issues. End by reporting the final task path, dependencies, and any assumptions recorded in the task.
