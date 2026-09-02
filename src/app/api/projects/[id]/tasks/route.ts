import { getProject, ProjectStoreError } from "@/lib/projects-store";
import {
  createTask,
  listProjectTasks,
  TaskStoreError,
  TaskValidationError,
  TASKS_PAGE_SIZE,
} from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

function pageFromRequest(request: Request): number {
  const value = new URL(request.url).searchParams.get("page");
  const page = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/projects/[id]/tasks">,
) {
  const { id } = await context.params;

  try {
    const project = await getProject(id);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    return Response.json(await listProjectTasks(id, {
      page: pageFromRequest(request),
      pageSize: TASKS_PAGE_SIZE,
    }));
  } catch (error) {
    console.error("Unable to list project tasks", error);
    const message = error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and try again."
      : "Task data could not be read. Check data/tasks.json and try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/projects/[id]/tasks">,
) {
  const { id } = await context.params;
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const project = await getProject(id);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    const task = await createTask(id, input);
    return Response.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and try again."
      : error instanceof TaskStoreError
        ? "Task data could not be written. Check data/tasks.json and try again."
        : "Unable to create the task. Try again.";
    console.error("Unable to create project task", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
