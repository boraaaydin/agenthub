import {
  ApplicationStoreError,
  ApplicationValidationError,
  createApplication,
  listApplications,
} from "@/lib/applications-store";
import {
  createProject,
  deleteProject,
  listProjects,
  ProjectStoreError,
  ProjectValidationError,
} from "@/lib/projects-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [projects, applications] = await Promise.all([listProjects(), listApplications()]);
    return Response.json(
      projects.map((project) => ({
        ...project,
        applications: applications.filter((application) => application.projectId === project.id),
      })),
    );
  } catch (error) {
    console.error("Unable to list projects", error);
    const message = error instanceof ApplicationStoreError
      ? "Application data could not be read. Check data/applications.json and try again."
      : "Project data could not be read. Check data/projects.json and try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  let projectId: string | null = null;
  try {
    const project = await createProject(input);
    projectId = project.id;
    const applicationInput = input && typeof input === "object" && "application" in input
      ? (input as Record<string, unknown>).application
      : { name: project.name, path: project.path };
    await createApplication(project.id, applicationInput);
    return Response.json(project, { status: 201 });
  } catch (error) {
    if (projectId) {
      try {
        await deleteProject(projectId);
      } catch (rollbackError) {
        console.error("Unable to roll back project after application creation failed", rollbackError);
      }
    }

    if (error instanceof ProjectValidationError || error instanceof ApplicationValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof ProjectStoreError
      ? "Project data could not be written. Check data/projects.json and try again."
      : error instanceof ApplicationStoreError
        ? "Application data could not be written. Check data/applications.json and try again."
        : "Unable to create the project. Try again.";
    console.error("Unable to create project", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
