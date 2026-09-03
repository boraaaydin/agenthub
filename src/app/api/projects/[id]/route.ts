import {
  deleteProject,
  ProjectStoreError,
  ProjectValidationError,
  updateProject,
} from "@/lib/projects-store";
import { deleteProjectWorkitems, WorkitemStoreError } from "@/lib/workitems-store";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/projects/[id]">,
) {
  const { id } = await context.params;
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const project = await updateProject(id, input);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }
    return Response.json(project);
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof ProjectStoreError
      ? "Project data could not be updated. Check data/projects.json and try again."
      : "Unable to update the project. Try again.";
    console.error("Unable to update project", error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/projects/[id]">,
) {
  const { id } = await context.params;
  const deleteTasks = new URL(request.url).searchParams.get("deleteTasks") === "true";

  try {
    const project = await deleteProject(id);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }
    if (deleteTasks) {
      await deleteProjectWorkitems(id);
    }
    return Response.json(project);
  } catch (error) {
    const message = error instanceof ProjectStoreError
      ? "Project data could not be updated. Check data/projects.json and try again."
      : error instanceof WorkitemStoreError
        ? "Task data could not be updated. Check data/tasks.json and try again."
        : "Unable to delete the project. Try again.";
    console.error("Unable to delete project", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
