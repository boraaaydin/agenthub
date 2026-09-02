import {
  createProject,
  listProjects,
  ProjectStoreError,
  ProjectValidationError,
} from "@/lib/projects-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listProjects());
  } catch (error) {
    console.error("Unable to list projects", error);
    return Response.json(
      { error: "Project data could not be read. Check data/projects.json and try again." },
      { status: 500 },
    );
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
    const project = await createProject(input);
    return Response.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof ProjectStoreError
      ? "Project data could not be written. Check data/projects.json and try again."
      : "Unable to create the project. Try again.";
    console.error("Unable to create project", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
