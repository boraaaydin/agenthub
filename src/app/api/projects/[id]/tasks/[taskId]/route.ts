import { LifecycleLogStoreError } from "@/lib/lifecycle-log-store";
import {
  deleteTask,
  getTask,
  TaskStoreError,
  TaskValidationError,
  updateTask,
} from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/projects/[id]/tasks/[taskId]">,
) {
  const { id, taskId } = await context.params;
  const parsedTaskId = Number.parseInt(taskId, 10);
  if (!Number.isInteger(parsedTaskId) || parsedTaskId <= 0 || String(parsedTaskId) !== taskId) {
    return Response.json({ error: "Task not found." }, { status: 404 });
  }

  try {
    const task = await getTask(id, parsedTaskId);
    if (!task) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }
    return Response.json(task);
  } catch (error) {
    const message = error instanceof TaskStoreError
      ? "Task data could not be read. Check data/tasks.json and try again."
      : "Unable to load the task. Try again.";
    console.error("Unable to read project task", error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/projects/[id]/tasks/[taskId]">,
) {
  const { id, taskId } = await context.params;
  const parsedTaskId = Number.parseInt(taskId, 10);
  if (!Number.isInteger(parsedTaskId) || parsedTaskId <= 0 || String(parsedTaskId) !== taskId) {
    return Response.json({ error: "Task not found." }, { status: 404 });
  }

  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const task = await updateTask(id, parsedTaskId, input);
    if (!task) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }
    return Response.json(task);
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof LifecycleLogStoreError
      ? "The task status was saved, but its lifecycle event could not be written. Check data/lifecycle-log.json before retrying."
      : error instanceof TaskStoreError
        ? "Task data could not be updated. Check data/tasks.json and try again."
        : "Unable to update the task. Try again.";
    console.error("Unable to update project task", error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/projects/[id]/tasks/[taskId]">,
) {
  const { id, taskId } = await context.params;
  const parsedTaskId = Number.parseInt(taskId, 10);
  if (!Number.isInteger(parsedTaskId) || parsedTaskId <= 0 || String(parsedTaskId) !== taskId) {
    return Response.json({ error: "Task not found." }, { status: 404 });
  }

  try {
    const task = await deleteTask(id, parsedTaskId);
    if (!task) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }
    return Response.json(task);
  } catch (error) {
    const message = error instanceof TaskStoreError
      ? "Task data could not be updated. Check data/tasks.json and try again."
      : "Unable to delete the task. Try again.";
    console.error("Unable to delete project task", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
