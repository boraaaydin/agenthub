import { listApplications, ApplicationStoreError } from "@/lib/applications-store";
import { NewTaskForm } from "./new-task-form";
import { listProjects, ProjectStoreError } from "@/lib/projects-store";
import { listAllWorkitems, WorkitemStoreError } from "@/lib/workitems-store";

export const dynamic = "force-dynamic";

export default async function NewTaskPage(props: PageProps<"/tasks/new">) {
  const searchParams = await props.searchParams;
  const requestedProjectId = Array.isArray(searchParams.project) ? searchParams.project[0] : searchParams.project;
  let projects: { id: string; name: string }[] = [];
  let applicationsByProject: Record<string, { id: string; name: string }[]> = {};
  let workitemsByProject: Record<string, { id: number; title: string }[]> = {};
  let error = "";

  try {
    const [savedProjects, applications, workitemPage] = await Promise.all([
      listProjects(),
      listApplications(),
      listAllWorkitems({ page: 1, pageSize: 500 }),
    ]);
    projects = savedProjects.map(({ id, name }) => ({ id, name }));
    applicationsByProject = applications.reduce<Record<string, { id: string; name: string }[]>>((groups, application) => {
      (groups[application.projectId] ??= []).push({ id: application.id, name: application.name });
      return groups;
    }, {});
    workitemsByProject = workitemPage.workitems.reduce<Record<string, { id: number; title: string }[]>>((groups, workitem) => {
      (groups[workitem.projectId] ??= []).push({ id: workitem.id, title: workitem.title });
      return groups;
    }, {});
  } catch (caughtError) {
    console.error("Unable to load new task form", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : caughtError instanceof ApplicationStoreError
        ? "Application data could not be read. Check data/applications.json and reload this page."
        : caughtError instanceof WorkitemStoreError
          ? "Workitem data could not be read. Check data/workitems.json and reload this page."
          : "Projects, applications, and workitems could not be loaded. Reload this page and try again.";
  }

  const initialProjectId = projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId ?? ""
    : projects.length === 1
      ? projects[0].id
      : "";

  return (
    <NewTaskForm
      projects={projects}
      applicationsByProject={applicationsByProject}
      workitemsByProject={workitemsByProject}
      initialProjectId={initialProjectId}
      error={error}
    />
  );
}
