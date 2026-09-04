import { LifecycleLogStoreError } from "@/lib/lifecycle-log-store";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import { deleteTaskFile } from "@/lib/task-file";
import { deleteTasksForWorkitem, listTasksForWorkitem, TaskStoreError } from "@/lib/tasks-store";
import { getWorkitem, updateWorkitem, WorkitemStoreError } from "@/lib/workitems-store";

export const dynamic = "force-dynamic";

const RESETTABLE_WORKITEM_STATUSES = ["task_creating", "task_created"];

function failure(error: unknown) {
  console.error("Unable to delete workitem tasks", error);
  const message = error instanceof LifecycleLogStoreError
    ? "The tasks were deleted, but the workitem lifecycle event could not be written. Check data/lifecycle-log.json before retrying."
    : error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and try again."
      : error instanceof WorkitemStoreError
        ? "Workitem data could not be updated. Check data/workitems.json and try again."
        : error instanceof TaskStoreError
          ? "Task data could not be updated. Check data/tasks.json and try again."
          : "Unable to delete the workitem tasks. Try again.";
  return Response.json({ error: message }, { status: 500 });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/projects/[id]/workitems/[workitemId]/tasks">,
) {
  const { id, workitemId } = await context.params;
  const parsedWorkitemId = Number.parseInt(workitemId, 10);
  if (!Number.isInteger(parsedWorkitemId) || parsedWorkitemId <= 0 || String(parsedWorkitemId) !== workitemId) {
    return Response.json({ error: "Workitem not found." }, { status: 404 });
  }

  try {
    const project = await getProject(id);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }
    const workitem = await getWorkitem(project.id, parsedWorkitemId);
    if (!workitem) {
      return Response.json({ error: "Workitem not found." }, { status: 404 });
    }

    const tasks = await listTasksForWorkitem(project.id, parsedWorkitemId);
    if (tasks.length === 0) {
      return Response.json({ deletedCount: 0, fileDeletedCount: 0, status: workitem.status });
    }

    let fileDeletedCount = 0;
    const fileErrors: string[] = [];
    for (const task of tasks) {
      const result = await deleteTaskFile(project.path, task.filePath);
      if (result.status === "deleted") {
        fileDeletedCount += 1;
      } else if (result.status === "error") {
        fileErrors.push(result.message ?? `The file for task #${task.id} could not be deleted.`);
      } else if (result.status === "invalid-path") {
        fileErrors.push(`The file for task #${task.id} is outside the project directory and was left in place.`);
      }
    }

    const deletedTasks = await deleteTasksForWorkitem(project.id, parsedWorkitemId);

    let status = workitem.status;
    if (RESETTABLE_WORKITEM_STATUSES.includes(workitem.status)) {
      const updatedWorkitem = await updateWorkitem(project.id, parsedWorkitemId, { status: "open" });
      status = updatedWorkitem?.status ?? status;
    }

    return Response.json({
      deletedCount: deletedTasks.length,
      fileDeletedCount,
      ...(fileErrors.length > 0 ? { fileErrors } : {}),
      status,
    });
  } catch (error) {
    return failure(error);
  }
}
