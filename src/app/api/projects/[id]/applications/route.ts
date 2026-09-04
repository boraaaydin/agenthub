import {
  ApplicationStoreError,
  ApplicationValidationError,
  createApplication,
  listProjectApplications,
} from "@/lib/applications-store";
import { getProject, ProjectStoreError } from "@/lib/projects-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/projects/[id]/applications">,
) {
  const { id } = await context.params;

  try {
    const project = await getProject(id);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }
    return Response.json(await listProjectApplications(id));
  } catch (error) {
    const message = error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and try again."
      : "Application data could not be read. Check data/applications.json and try again.";
    console.error("Unable to list project applications", error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/projects/[id]/applications">,
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

    const application = await createApplication(id, input);
    return Response.json(application, { status: 201 });
  } catch (error) {
    if (error instanceof ApplicationValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and try again."
      : error instanceof ApplicationStoreError
        ? "Application data could not be written. Check data/applications.json and try again."
        : "Unable to create the application. Try again.";
    console.error("Unable to create project application", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
