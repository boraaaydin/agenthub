import { notFound, redirect } from "next/navigation";

import { getProject } from "@/lib/projects-store";

export const dynamic = "force-dynamic";

export default async function ProjectNewWorkitemPage(props: PageProps<"/projects/[id]/workitems/new">) {
  const { id } = await props.params;
  let project;
  let couldNotLoadProject = false;

  try {
    project = await getProject(id);
  } catch (error) {
    console.error("Unable to validate project before redirecting to new workitem", error);
    couldNotLoadProject = true;
  }

  if (!couldNotLoadProject && !project) {
    notFound();
  }

  redirect(`/workitems/new?project=${encodeURIComponent(id)}`);
}
