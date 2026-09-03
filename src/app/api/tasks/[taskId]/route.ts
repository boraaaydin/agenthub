import { LifecycleLogStoreError } from "@/lib/lifecycle-log-store";
import { deleteTaskFile } from "@/lib/task-file";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import {
  deleteTask,
  getTask,
  taskPatch,
  TaskStoreError,
  TaskValidationError,
  updateTask,
} from "@/lib/tasks-store";
import { getTask, TaskStoreError } from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

function invalidTaskResponse() {
  return Response.json({ error: "Task not found." }, { status: 404 });
}

function parseTaskId(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === raw ? parsed : null;
}

function storeFailure(error: unknown, operation: string): Response {
  console.error(`Unable to ${operation} task`, error);
  const message = error instanceof LifecycleLogStoreError
    ? "The task status was saved, but its lifecycle event could not be written. Check data/lifecycle-log.json before retrying."
    : error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and try again."
      : error instanceof TaskStoreError
        ? "Task data could not be read. Check data/tasks.json and try again."
        : error instanceof TaskStoreError
          ? `Task data could not be ${operation === "read" ? "read" : "updated"}. Check data/tasks.json and try again.`
          : `Unable to ${operation} the task. Try again.`;
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/tasks/[taskId]">,
) {
  const { taskId: rawTaskId } = await context.params;
  const taskId = parseTaskId(rawTaskId);
  if (!taskId) {
    return invalidTaskResponse();
  }

  try {
    const task = await getTask(taskId);
    return task ? Response.json(task) : invalidTaskResponse();
  } catch (error) {
    return storeFailure(error, "read");
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/tasks/[taskId]">,
) {
  const { taskId: rawTaskId } = await context.params;
  const taskId = parseTaskId(rawTaskId);
  if (!taskId) {
    return invalidTaskResponse();
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const task = await getTask(taskId);
    if (!task) {
      return invalidTaskResponse();
    }
    const patch = taskPatch(input);
    const projectId = patch.projectId ?? task.projectId;
    const taskId = patch.taskId ?? task.taskId;
    const project = await getProject(projectId);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }
    const task = await getTask(project.id, taskId);
    if (!task) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }

    const updatedTask = await updateTask(taskId, patch);
    return updatedTask ? Response.json(updatedTask) : invalidTaskResponse();
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return storeFailure(error, "update");
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/tasks/[taskId]">,
) {
  const { taskId: rawTaskId } = await context.params;
  const taskId = parseTaskId(rawTaskId);
  if (!taskId) {
    return invalidTaskResponse();
  }

  try {
    const task = await getTask(taskId);
    if (!task) {
      return invalidTaskResponse();
    }

    let fileDeleted = false;
    let fileError: string | undefined;
    if (new URL(request.url).searchParams.get("file") === "delete") {
      const project = await getProject(task.projectId);
      if (project) {
        const result = await deleteTaskFile(project.path, task.filePath);
        fileDeleted = result.status === "deleted";
        if (result.status === "error") {
          fileError = result.message;
        }
      }
    }

    const deletedTask = await deleteTask(taskId);
    if (!deletedTask) {
      return invalidTaskResponse();
    }
    return Response.json({ ...deletedTask, fileDeleted, ...(fileError ? { fileError } : {}) });
  } catch (error) {
    return storeFailure(error, "delete");
  }
}
