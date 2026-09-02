import { deleteProject, ProjectStoreError } from "@/lib/projects-store";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/projects/[id]">,
) {
  const { id } = await context.params;

  try {
    const project = await deleteProject(id);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }
    return Response.json(project);
  } catch (error) {
    const message = error instanceof ProjectStoreError
      ? "Project data could not be updated. Check data/projects.json and try again."
      : "Unable to delete the project. Try again.";
    console.error("Unable to delete project", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
