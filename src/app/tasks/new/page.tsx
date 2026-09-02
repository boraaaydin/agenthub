import { NewTaskForm } from "./new-task-form";
import { listProjects, ProjectStoreError } from "@/lib/projects-store";

export const dynamic = "force-dynamic";

export default async function NewTaskPage(props: PageProps<"/tasks/new">) {
  const searchParams = await props.searchParams;
  const requestedProjectId = Array.isArray(searchParams.project) ? searchParams.project[0] : searchParams.project;
  let projects: { id: string; name: string }[] = [];
  let error = "";

  try {
    const savedProjects = await listProjects();
    projects = savedProjects.map(({ id, name }) => ({ id, name }));
  } catch (caughtError) {
    console.error("Unable to load projects for new task", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : "Projects could not be loaded. Reload this page and try again.";
  }

  const selectedProjectId = projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId ?? ""
    : projects.length === 1
      ? projects[0].id
      : "";

  return <NewTaskForm projects={projects} initialProjectId={selectedProjectId} error={error} />;
}
