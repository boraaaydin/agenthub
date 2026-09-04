import {
  ApplicationStoreError,
  ApplicationValidationError,
  deleteApplication,
  getApplication,
  updateApplication,
} from "@/lib/applications-store";
import { getProject, ProjectStoreError } from "@/lib/projects-store";

export const dynamic = "force-dynamic";

type Params = RouteContext<"/api/projects/[id]/applications/[applicationId]">;

async function findProjectApplication(context: Params) {
  const { id, applicationId } = await context.params;
  const project = await getProject(id);
  if (!project) {
    return { error: Response.json({ error: "Project not found." }, { status: 404 }) };
  }

  const application = await getApplication(applicationId);
  if (!application || application.projectId !== id) {
    return { error: Response.json({ error: "Application not found." }, { status: 404 }) };
  }

  return { application };
}

export async function PATCH(request: Request, context: Params) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const result = await findProjectApplication(context);
    if (result.error) {
      return result.error;
    }

    const application = await updateApplication(result.application.id, input);
    if (!application) {
      return Response.json({ error: "Application not found." }, { status: 404 });
    }
    return Response.json(application);
  } catch (error) {
    if (error instanceof ApplicationValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and try again."
      : error instanceof ApplicationStoreError
        ? "Application data could not be updated. Check data/applications.json and try again."
        : "Unable to update the application. Try again.";
    console.error("Unable to update project application", error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Params) {
  try {
    const result = await findProjectApplication(context);
    if (result.error) {
      return result.error;
    }

    const application = await deleteApplication(result.application.id);
    if (!application) {
      return Response.json({ error: "Application not found." }, { status: 404 });
    }
    return Response.json(application);
  } catch (error) {
    if (error instanceof ApplicationValidationError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    const message = error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and try again."
      : error instanceof ApplicationStoreError
        ? "Application data could not be updated. Check data/applications.json and try again."
        : "Unable to delete the application. Try again.";
    console.error("Unable to delete project application", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
