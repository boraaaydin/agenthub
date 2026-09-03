import { getProject, ProjectStoreError } from "@/lib/projects-store";
import {
  createPlan,
  listAllPlans,
  planTaskKey,
  PlanStoreError,
  PlanValidationError,
  PLANS_PAGE_SIZE,
} from "@/lib/plans-store";
import { TERMINAL_TASK_STATUSES } from "@/lib/task-filters";
import { getTask, listTasksByStatuses, TaskStoreError, updateTask } from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

function pageFromRequest(request: Request): number {
  const value = new URL(request.url).searchParams.get("page");
  const page = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function projectFromRequest(request: Request): string | undefined {
  return new URL(request.url).searchParams.get("project")?.trim() || undefined;
}

function includesAllTasks(request: Request): boolean {
  return new URL(request.url).searchParams.get("all") === "true";
}

export async function GET(request: Request) {
  try {
    const excludedTaskKeys = includesAllTasks(request)
      ? undefined
      : new Set((await listTasksByStatuses(TERMINAL_TASK_STATUSES)).map((task) => planTaskKey(task.projectId, task.id)));

    return Response.json(await listAllPlans({
      page: pageFromRequest(request),
      pageSize: PLANS_PAGE_SIZE,
      projectId: projectFromRequest(request),
      excludedTaskKeys,
    }));
  } catch (error) {
    console.error("Unable to list plans", error);
    const message = error instanceof TaskStoreError
      ? "Task data could not be read. Check data/tasks.json and try again."
      : "Plan data could not be read. Check data/plans.json and try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new PlanValidationError("Plan details are required.");
    }
    const { projectId, taskId } = input as Record<string, unknown>;
    if (typeof projectId !== "string" || !projectId.trim()) {
      throw new PlanValidationError("Enter a project ID.");
    }

    const project = await getProject(projectId.trim());
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    const normalizedTaskId = typeof taskId === "number"
      ? taskId
      : typeof taskId === "string" && /^\d+$/.test(taskId) && String(Number(taskId)) === taskId
        ? Number(taskId)
        : Number.NaN;
    if (Number.isInteger(normalizedTaskId) && normalizedTaskId > 0) {
      const task = await getTask(project.id, normalizedTaskId);
      if (!task) {
        return Response.json({ error: "Task not found." }, { status: 404 });
      }
    }

    const plan = await createPlan({ ...input, projectId: project.id });

    try {
      const task = await getTask(project.id, plan.taskId);
      if (task?.status === "open" || task?.status === "in_progress") {
        await updateTask(project.id, plan.taskId, { status: "plan_created" });
      }
    } catch (error) {
      console.error("Unable to mark the task as planned", error);
    }

    return Response.json(plan, { status: 201 });
  } catch (error) {
    if (error instanceof PlanValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    console.error("Unable to create plan", error);
    const message = error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and try again."
      : error instanceof TaskStoreError
        ? "Task data could not be read. Check data/tasks.json and try again."
        : error instanceof PlanStoreError
          ? "Plan data could not be written. Check data/plans.json and try again."
          : "Unable to create the plan. Try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}
