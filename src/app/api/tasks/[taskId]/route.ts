import { LifecycleLogStoreError } from "@/lib/lifecycle-log-store";
import { deleteTaskFile } from "@/lib/task-file";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import { deleteTask, getTask, taskPatch, TaskStoreError, TaskValidationError, updateTask } from "@/lib/tasks-store";
import { getWorkitem, WorkitemStoreError } from "@/lib/workitems-store";

export const dynamic = "force-dynamic";
function parseTaskId(raw: string): number | null { const id = Number.parseInt(raw, 10); return Number.isInteger(id) && id > 0 && String(id) === raw ? id : null; }
function missing() { return Response.json({ error: "Task not found." }, { status: 404 }); }
function failure(error: unknown, operation: string) {
  console.error(`Unable to ${operation} task`, error);
  const message = error instanceof LifecycleLogStoreError ? "The task status was saved, but its lifecycle event could not be written. Check data/lifecycle-log.json before retrying."
    : error instanceof ProjectStoreError ? "Project data could not be read. Check data/projects.json and try again."
      : error instanceof WorkitemStoreError ? "Workitem data could not be read. Check data/workitems.json and try again."
        : error instanceof TaskStoreError ? `Task data could not be ${operation === "read" ? "read" : "updated"}. Check data/tasks.json and try again.`
          : `Unable to ${operation} the task. Try again.`;
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(_request: Request, context: RouteContext<"/api/tasks/[taskId]">) {
  const taskId = parseTaskId((await context.params).taskId);
  if (!taskId) return missing();
  try { const task = await getTask(taskId); return task ? Response.json(task) : missing(); }
  catch (error) { return failure(error, "read"); }
}

export async function PATCH(request: Request, context: RouteContext<"/api/tasks/[taskId]">) {
  const taskId = parseTaskId((await context.params).taskId);
  if (!taskId) return missing();
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  try {
    const task = await getTask(taskId);
    if (!task) return missing();
    const patch = taskPatch(input);
    const projectId = patch.projectId ?? task.projectId;
    const project = await getProject(projectId);
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    const workitemId = patch.workitemId ?? task.workitemId;
    if (!await getWorkitem(project.id, workitemId)) return Response.json({ error: "Workitem not found." }, { status: 404 });
    const updated = await updateTask(taskId, patch);
    return updated ? Response.json(updated) : missing();
  } catch (error) { if (error instanceof TaskValidationError) return Response.json({ error: error.message }, { status: 400 }); return failure(error, "update"); }
}

export async function DELETE(request: Request, context: RouteContext<"/api/tasks/[taskId]">) {
  const taskId = parseTaskId((await context.params).taskId);
  if (!taskId) return missing();
  try {
    const task = await getTask(taskId);
    if (!task) return missing();
    let fileDeleted = false; let fileError: string | undefined;
    if (new URL(request.url).searchParams.get("file") === "delete") {
      const project = await getProject(task.projectId);
      if (project) { const result = await deleteTaskFile(project.path, task.filePath); fileDeleted = result.status === "deleted"; if (result.status === "error") fileError = result.message; }
    }
    const deleted = await deleteTask(taskId);
    return deleted ? Response.json({ ...deleted, fileDeleted, ...(fileError ? { fileError } : {}) }) : missing();
  } catch (error) { return failure(error, "delete"); }
}
