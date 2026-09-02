import { deletePlanFile } from "@/lib/plan-file";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import {
  deletePlan,
  getPlan,
  planPatch,
  PlanStoreError,
  PlanValidationError,
  updatePlan,
} from "@/lib/plans-store";
import { getTask, TaskStoreError } from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

function invalidPlanResponse() {
  return Response.json({ error: "Plan not found." }, { status: 404 });
}

function parsePlanId(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === raw ? parsed : null;
}

function storeFailure(error: unknown, operation: string): Response {
  console.error(`Unable to ${operation} plan`, error);
  const message = error instanceof ProjectStoreError
    ? "Project data could not be read. Check data/projects.json and try again."
    : error instanceof TaskStoreError
      ? "Task data could not be read. Check data/tasks.json and try again."
      : error instanceof PlanStoreError
        ? `Plan data could not be ${operation === "read" ? "read" : "updated"}. Check data/plans.json and try again.`
        : `Unable to ${operation} the plan. Try again.`;
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/plans/[planId]">,
) {
  const { planId: rawPlanId } = await context.params;
  const planId = parsePlanId(rawPlanId);
  if (!planId) {
    return invalidPlanResponse();
  }

  try {
    const plan = await getPlan(planId);
    return plan ? Response.json(plan) : invalidPlanResponse();
  } catch (error) {
    return storeFailure(error, "read");
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/plans/[planId]">,
) {
  const { planId: rawPlanId } = await context.params;
  const planId = parsePlanId(rawPlanId);
  if (!planId) {
    return invalidPlanResponse();
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const plan = await getPlan(planId);
    if (!plan) {
      return invalidPlanResponse();
    }
    const patch = planPatch(input);
    const projectId = patch.projectId ?? plan.projectId;
    const taskId = patch.taskId ?? plan.taskId;
    const project = await getProject(projectId);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }
    const task = await getTask(project.id, taskId);
    if (!task) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }

    const updatedPlan = await updatePlan(planId, patch);
    return updatedPlan ? Response.json(updatedPlan) : invalidPlanResponse();
  } catch (error) {
    if (error instanceof PlanValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return storeFailure(error, "update");
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/plans/[planId]">,
) {
  const { planId: rawPlanId } = await context.params;
  const planId = parsePlanId(rawPlanId);
  if (!planId) {
    return invalidPlanResponse();
  }

  try {
    const plan = await getPlan(planId);
    if (!plan) {
      return invalidPlanResponse();
    }

    let fileDeleted = false;
    let fileError: string | undefined;
    if (new URL(request.url).searchParams.get("file") === "delete") {
      const project = await getProject(plan.projectId);
      if (project) {
        const result = await deletePlanFile(project.path, plan.filePath);
        fileDeleted = result.status === "deleted";
        if (result.status === "error") {
          fileError = result.message;
        }
      }
    }

    const deletedPlan = await deletePlan(planId);
    if (!deletedPlan) {
      return invalidPlanResponse();
    }
    return Response.json({ ...deletedPlan, fileDeleted, ...(fileError ? { fileError } : {}) });
  } catch (error) {
    return storeFailure(error, "delete");
  }
}
