import { NewWorkitemForm } from "./new-workitem-form";
import { workitemFilterStatus } from "@/lib/workitem-filters";
import { listProjects, ProjectStoreError } from "@/lib/projects-store";

export const dynamic = "force-dynamic";

export default async function NewWorkitemPage(props: PageProps<"/workitems/new">) {
  const searchParams = await props.searchParams;
  const requestedProjectId = Array.isArray(searchParams.project) ? searchParams.project[0] : searchParams.project;
  const requestedStatus = Array.isArray(searchParams.status) ? searchParams.status[0] : searchParams.status;
  const requestedAll = Array.isArray(searchParams.all) ? searchParams.all[0] : searchParams.all;
  const requestedKind = Array.isArray(searchParams.kind) ? searchParams.kind[0] : searchParams.kind;
  let projects: { id: string; name: string }[] = [];
  let error = "";

  try {
    const savedProjects = await listProjects();
    projects = savedProjects.map(({ id, name }) => ({ id, name }));
  } catch (caughtError) {
    console.error("Unable to load projects for new workitem", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : "Projects could not be loaded. Reload this page and try again.";
  }

  const selectedProjectId = projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId ?? ""
    : projects.length === 1
      ? projects[0].id
      : "";

  return <NewWorkitemForm
    projects={projects}
    initialProjectId={selectedProjectId}
    initialStatus={workitemFilterStatus(requestedStatus, requestedAll, requestedKind)}
    error={error}
  />;
}
