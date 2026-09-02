import {
  deleteTask,
  TaskStoreError,
  TaskValidationError,
  updateTask,
} from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/projects/[id]/tasks/[taskId]">,
) {
  const { id, taskId } = await context.params;
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const task = await updateTask(id, taskId, input);
    if (!task) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }
    return Response.json(task);
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof TaskStoreError
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

  try {
    const task = await deleteTask(id, taskId);
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
