import {
  ApplicationStoreError,
  getApplication,
} from "@/lib/applications-store";
import { readDefaultSettingsPrompt } from "@/lib/default-settings-prompts";
import { resolveTaskFilePath } from "@/lib/task-file";
import { getTask, TaskStoreError } from "@/lib/tasks-store";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import { readSettings, SettingsStoreError } from "@/lib/settings-store";
import { composeTaskPrompt } from "@/lib/task-execution";

export const dynamic = "force-dynamic";

function taskNotFoundResponse() {
  return Response.json({ error: "Task not found." }, { status: 404 });
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
  request: Request,
  context: RouteContext<"/api/tasks/[taskId]/execution-prompt">,
) {
  const { taskId: rawTaskId } = await context.params;
  const taskId = Number.parseInt(rawTaskId, 10);
  if (!Number.isInteger(taskId) || taskId <= 0 || String(taskId) !== rawTaskId) {
    return taskNotFoundResponse();
  }

  let task;
  let project;
  let application;
  let settings;

  try {
    task = await getTask(taskId);
    if (!task) {
      return taskNotFoundResponse();
    }
    project = await getProject(task.projectId);
    if (!project) {
      return taskNotFoundResponse();
    }
    application = await getApplication(task.applicationId);
    if (!application) {
      return Response.json(
        { error: "The task's application no longer exists. Add or select an application before executing this task." },
        { status: 409 },
      );
    }
    if (application.projectId !== project.id) {
      return Response.json(
        { error: "The task's application does not belong to its project. Select a matching application before executing this task." },
        { status: 409 },
      );
    }
    settings = await readSettings();
  } catch (error) {
    const message = error instanceof TaskStoreError
      ? "Task data could not be read. Check data/tasks.json and try again."
      : error instanceof ProjectStoreError
        ? "Project data could not be read. Check data/projects.json and try again."
        : error instanceof ApplicationStoreError
          ? "Application data could not be read. Check data/applications.json and try again."
          : error instanceof SettingsStoreError
            ? "Settings could not be read. Check data/settings.json and try again."
            : "Unable to prepare the task. Try again.";
    console.error("Unable to prepare task", error);
    return Response.json({ error: message }, { status: 500 });
  }

  if (!resolveTaskFilePath(project.path, task.filePath)) {
    return Response.json(
      { error: "The task file path must be relative to its project directory." },
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
    taskId: task.id,
    projectId: project.id,
    projectName: project.name,
    projectPath: project.path,
    projectSlug: project.slug,
    applicationId: application.id,
    applicationName: application.name,
    applicationPath: application.path,
    workitemId: task.workitemId,
    filePath: task.filePath,
    prompt: composeTaskPrompt({
      taskPrompt,
      taskPostPrompt,
      projectName: project.name,
      projectPath: project.path,
      projectSlug: project.slug,
      taskId: task.id,
      workitemId: task.workitemId,
      taskTitle: task.title,
      filePath: task.filePath,
      summary: task.summary,
      applicationName: application.name,
      applicationPath: application.path,
      taskEndpoint: `${new URL(request.url).origin}/api/tasks/${task.id}`,
    }),
  });
}
