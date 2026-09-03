import { notFound } from "next/navigation";

import { BrandBar } from "../../../../brand-bar";
import WorkitemDetail from "./workitem-detail";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import { getWorkitem, WorkitemStoreError } from "@/lib/workitems-store";

export const dynamic = "force-dynamic";

export default async function WorkitemDetailPage(props: PageProps<"/projects/[id]/workitems/[workitemId]">) {
  const { id, workitemId } = await props.params;
  const parsedWorkitemId = Number.parseInt(workitemId, 10);
  if (!Number.isInteger(parsedWorkitemId) || parsedWorkitemId <= 0 || String(parsedWorkitemId) !== workitemId) {
    notFound();
  }

  let project;
  let workitem;
  let error = "";

  try {
    project = await getProject(id);
    if (project) {
      workitem = await getWorkitem(id, parsedWorkitemId);
    }
  } catch (caughtError) {
    console.error("Unable to render project workitem", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : caughtError instanceof WorkitemStoreError
        ? "Workitem data could not be read. Check data/workitems.json and reload this page."
        : "Workitem details could not be loaded. Reload this page and try again.";
  }

  if (!error && (!project || !workitem)) {
    notFound();
  }

  if (error || !project || !workitem) {
    return (
      <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-2xl">
          <BrandBar />
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Workitem unavailable</h1>
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        </div>
      </main>
    );
  }

  return <WorkitemDetail key={workitem.id} projectName={project.name} projectColor={project.color} workitem={workitem} />;
}
