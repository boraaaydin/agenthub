import { readDefaultSettingsPrompt } from "@/lib/default-settings-prompts";
import { resolvePlanFilePath } from "@/lib/plan-file";
import { getPlan, PlanStoreError } from "@/lib/plans-store";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import { readSettings, SettingsStoreError } from "@/lib/settings-store";
import { composeTaskPrompt } from "@/lib/task-run";

export const dynamic = "force-dynamic";

function planNotFoundResponse() {
  return Response.json({ error: "Plan not found." }, { status: 404 });
}

async function effectivePrompt(
  savedPrompt: string,
  field: "taskPrompt" | "taskPostPrompt",
): Promise<string> {
  if (savedPrompt.trim()) {
    return savedPrompt;
  }

  try {
    return await readDefaultSettingsPrompt(field);
  } catch (error) {
    console.error(`Unable to read the default ${field}`, error);
    return "";
  }
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/plans/[planId]/task-prompt">,
) {
  const { planId: rawPlanId } = await context.params;
  const planId = Number.parseInt(rawPlanId, 10);
  if (!Number.isInteger(planId) || planId <= 0 || String(planId) !== rawPlanId) {
    return planNotFoundResponse();
  }

  let plan;
  let project;
  let settings;

  try {
    plan = await getPlan(planId);
    if (!plan) {
      return planNotFoundResponse();
    }
    project = await getProject(plan.projectId);
    if (!project) {
      return planNotFoundResponse();
    }
    settings = await readSettings();
  } catch (error) {
    const message = error instanceof PlanStoreError
      ? "Plan data could not be read. Check data/plans.json and try again."
      : error instanceof ProjectStoreError
        ? "Project data could not be read. Check data/projects.json and try again."
        : error instanceof SettingsStoreError
          ? "Settings could not be read. Check data/settings.json and try again."
          : "Unable to prepare the task. Try again.";
    console.error("Unable to prepare plan task", error);
    return Response.json({ error: message }, { status: 500 });
  }

  if (!resolvePlanFilePath(project.path, plan.filePath)) {
    return Response.json(
      { error: "The plan file path must be relative to its project directory." },
      { status: 400 },
    );
  }

  const taskPrompt = await effectivePrompt(settings.taskPrompt, "taskPrompt");
  const taskPostPrompt = await effectivePrompt(settings.taskPostPrompt, "taskPostPrompt");
  if (!taskPrompt.trim()) {
    return Response.json(
      { error: "The task execution prompt is unavailable. Check the task prompt settings and try again." },
      { status: 500 },
    );
  }

  return Response.json({
    agent: settings.taskAgent,
    planId: plan.id,
    projectId: project.id,
    projectName: project.name,
    projectPath: project.path,
    taskId: plan.taskId,
    filePath: plan.filePath,
    prompt: composeTaskPrompt({
      taskPrompt,
      taskPostPrompt,
      projectName: project.name,
      projectPath: project.path,
      planId: plan.id,
      taskId: plan.taskId,
      planTitle: plan.title,
      filePath: plan.filePath,
      summary: plan.summary,
    }),
  });
}
