import { readDefaultSettingsPrompt } from "@/lib/default-settings-prompts";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import { readSettings, SettingsStoreError } from "@/lib/settings-store";
import { composePlanPrompt } from "@/lib/plan-prompt";
import { getWorkitem, WorkitemStoreError } from "@/lib/workitems-store";

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
  request: Request,
  context: RouteContext<"/api/projects/[id]/workitems/[workitemId]/plan-prompt">,
) {
  const { id, workitemId } = await context.params;
  const parsedWorkitemId = Number.parseInt(workitemId, 10);
  if (!Number.isInteger(parsedWorkitemId) || parsedWorkitemId <= 0 || String(parsedWorkitemId) !== workitemId) {
    return Response.json({ error: "Workitem not found." }, { status: 404 });
  }

  let project;
  let workitem;
  let settings;

  try {
    project = await getProject(id);
    if (project) {
      workitem = await getWorkitem(id, parsedWorkitemId);
    }
    if (!project || !workitem) {
      return Response.json({ error: "Workitem not found." }, { status: 404 });
    }
    settings = await readSettings();
  } catch (error) {
    const message = error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and try again."
      : error instanceof WorkitemStoreError
        ? "Workitem data could not be read. Check data/workitems.json and try again."
        : error instanceof SettingsStoreError
          ? "Settings could not be read. Check data/settings.json and try again."
          : "Unable to prepare the plan. Try again.";
    console.error("Unable to prepare project workitem plan", error);
    return Response.json({ error: message }, { status: 500 });
  }

  const planPrompt = await effectivePrompt(settings.planPrompt, "planPrompt");
  const planPostPrompt = await effectivePrompt(settings.planPostPrompt, "planPostPrompt");
  if (!planPrompt.trim()) {
    return Response.json(
      { error: "The workitem planning prompt is unavailable. Check the plan prompt settings and try again." },
      { status: 500 },
    );
  }

  return Response.json({
    agent: settings.planAgent,
    projectId: project.id,
    projectName: project.name,
    projectPath: project.path,
    workitemId: workitem.id,
    prompt: composePlanPrompt({
      planPrompt,
      planPostPrompt,
      projectName: project.name,
      projectPath: project.path,
      projectId: project.id,
      workitemId: workitem.id,
      taskTitle: workitem.title,
      taskDetail: workitem.detail,
      tasksEndpoint: `${new URL(request.url).origin}/api/tasks`,
    }),
  });
}
