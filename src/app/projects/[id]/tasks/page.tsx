import { notFound, redirect } from "next/navigation";

import { getProject } from "@/lib/projects-store";

export const dynamic = "force-dynamic";

export default async function ProjectTasksPage(props: PageProps<"/projects/[id]/tasks">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const requestedPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  let project;
  let couldNotLoadProject = false;

  try {
    project = await getProject(id);
  } catch (error) {
    console.error("Unable to validate project before redirecting to tasks", error);
    couldNotLoadProject = true;
  }

  if (!couldNotLoadProject && !project) {
    notFound();
  }

  const target = new URLSearchParams({ project: id });
  if (requestedPage !== undefined) {
    target.set("page", requestedPage);
  }
  redirect(`/tasks?${target.toString()}`);
}
