import { readDefaultSettingsPrompt } from "@/lib/default-settings-prompts";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import { readSettings, SettingsStoreError } from "@/lib/settings-store";
import { composePlanPrompt } from "@/lib/task-plan";
import { getTask, TaskStoreError } from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

async function effectivePrompt(
  savedPrompt: string,
  field: "planPrompt" | "planPostPrompt",
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
  context: RouteContext<"/api/projects/[id]/tasks/[taskId]/plan-prompt">,
) {
  const { id, taskId } = await context.params;
  const parsedTaskId = Number.parseInt(taskId, 10);
  if (!Number.isInteger(parsedTaskId) || parsedTaskId <= 0 || String(parsedTaskId) !== taskId) {
    return Response.json({ error: "Task not found." }, { status: 404 });
  }

  let project;
  let task;
  let settings;

  try {
    project = await getProject(id);
    if (project) {
      task = await getTask(id, parsedTaskId);
    }
    if (!project || !task) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }
    settings = await readSettings();
  } catch (error) {
    const message = error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and try again."
      : error instanceof TaskStoreError
        ? "Task data could not be read. Check data/tasks.json and try again."
        : error instanceof SettingsStoreError
          ? "Settings could not be read. Check data/settings.json and try again."
          : "Unable to prepare the plan. Try again.";
    console.error("Unable to prepare project task plan", error);
    return Response.json({ error: message }, { status: 500 });
  }

  const planPrompt = await effectivePrompt(settings.planPrompt, "planPrompt");
  const planPostPrompt = await effectivePrompt(settings.planPostPrompt, "planPostPrompt");
  if (!planPrompt.trim()) {
    return Response.json(
      { error: "The task planning prompt is unavailable. Check the plan prompt settings and try again." },
      { status: 500 },
    );
  }

  return Response.json({
    agent: settings.planAgent,
    projectId: project.id,
    projectName: project.name,
    projectPath: project.path,
    taskId: task.id,
    prompt: composePlanPrompt(planPrompt, task.id, task.title, task.detail, planPostPrompt),
  });
}
