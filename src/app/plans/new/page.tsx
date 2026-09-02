import { NewPlanForm } from "./new-plan-form";
import { listProjects, ProjectStoreError } from "@/lib/projects-store";
import { listAllTasks, TaskStoreError } from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

export default async function NewPlanPage(props: PageProps<"/plans/new">) {
  const searchParams = await props.searchParams;
  const requestedProjectId = Array.isArray(searchParams.project) ? searchParams.project[0] : searchParams.project;
  let projects: { id: string; name: string }[] = [];
  let tasksByProject: Record<string, { id: number; title: string }[]> = {};
  let error = "";

  try {
    const [savedProjects, taskPage] = await Promise.all([
      listProjects(),
      listAllTasks({ page: 1, pageSize: 500 }),
    ]);
    projects = savedProjects.map(({ id, name }) => ({ id, name }));
    tasksByProject = taskPage.tasks.reduce<Record<string, { id: number; title: string }[]>>((groups, task) => {
      (groups[task.projectId] ??= []).push({ id: task.id, title: task.title });
      return groups;
    }, {});
  } catch (caughtError) {
    console.error("Unable to load new plan form", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : caughtError instanceof TaskStoreError
        ? "Task data could not be read. Check data/tasks.json and reload this page."
        : "Projects and tasks could not be loaded. Reload this page and try again.";
  }

  const initialProjectId = projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId ?? ""
    : projects.length === 1
      ? projects[0].id
      : "";

  return <NewPlanForm projects={projects} tasksByProject={tasksByProject} initialProjectId={initialProjectId} error={error} />;
}
