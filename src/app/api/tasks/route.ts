import { LifecycleLogStoreError } from "@/lib/lifecycle-log-store";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import {
  createTask,
  listAllTasks,
  TaskStoreError,
  TaskValidationError,
  TASKS_PAGE_SIZE,
} from "@/lib/tasks-store";
import { ACTIVE_TASK_STATUSES, taskFilterStatus } from "@/lib/task-filters";
import { getWorkitem, updateWorkitem, WorkitemStoreError } from "@/lib/workitems-store";

export const dynamic = "force-dynamic";

function pageFromRequest(request: Request): number {
  const value = new URL(request.url).searchParams.get("page");
  const page = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = taskFilterStatus(url.searchParams.get("status") ?? undefined, url.searchParams.get("all") ?? undefined);
    return Response.json(await listAllTasks({
      page: pageFromRequest(request),
      pageSize: TASKS_PAGE_SIZE,
      projectId: url.searchParams.get("project")?.trim() || undefined,
      statuses: status === "all" ? undefined : status === "active" ? ACTIVE_TASK_STATUSES : [status],
    }));
  } catch (error) {
    console.error("Unable to list tasks", error);
    return Response.json({ error: "Task data could not be read. Check data/tasks.json and try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new TaskValidationError("Task details are required.");
    const { projectId, workitemId } = input as Record<string, unknown>;
    if (typeof projectId !== "string" || !projectId.trim()) throw new TaskValidationError("Enter a project ID.");
    const project = await getProject(projectId.trim());
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    const normalizedWorkitemId = typeof workitemId === "number" ? workitemId : typeof workitemId === "string" && /^\d+$/.test(workitemId) ? Number(workitemId) : Number.NaN;
    if (!Number.isInteger(normalizedWorkitemId) || normalizedWorkitemId <= 0) throw new TaskValidationError("Enter a positive workitem ID.");
    const workitem = await getWorkitem(project.id, normalizedWorkitemId);
    if (!workitem) return Response.json({ error: "Workitem not found." }, { status: 404 });

    const task = await createTask({ ...input, projectId: project.id, workitemId: normalizedWorkitemId });
    if (["open", "task_creating", "in_progress"].includes(workitem.status)) {
      await updateWorkitem(project.id, workitem.id, { status: "task_created" });
    }
    return Response.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof TaskValidationError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Unable to create task", error);
    const message = error instanceof LifecycleLogStoreError
      ? "The task or workitem status was saved, but its lifecycle event could not be written. Check data/lifecycle-log.json before retrying."
      : error instanceof ProjectStoreError ? "Project data could not be read. Check data/projects.json and try again."
        : error instanceof WorkitemStoreError ? "Workitem data could not be read. Check data/workitems.json and try again."
          : error instanceof TaskStoreError ? "Task data could not be written. Check data/tasks.json and try again."
            : "Unable to create the task. Try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}
