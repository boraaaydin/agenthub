import { notFound } from "next/navigation";

import { BrandBar } from "../../brand-bar";
import TaskDetail from "./task-detail";
import { getApplication, ApplicationStoreError } from "@/lib/applications-store";
import { readTaskFile } from "@/lib/task-file";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import { getTask, TaskStoreError } from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

function parseTaskId(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === raw ? parsed : null;
}

export default async function TaskDetailPage(props: PageProps<"/tasks/[taskId]">) {
  const { taskId: rawTaskId } = await props.params;
  const taskId = parseTaskId(rawTaskId);
  if (!taskId) {
    notFound();
  }

  let task: Awaited<ReturnType<typeof getTask>> = null;
  let project: { id: string; name: string; color?: string } | null = null;
  let projectPath: string | null = null;
  let application: { id: string; name: string; path: string } | null = null;
  let filePreview: Parameters<typeof TaskDetail>[0]["filePreview"] = { status: "missing-project" };
  let error = "";

  try {
    task = await getTask(taskId);
    if (!task) {
      notFound();
    }

    const savedProject = await getProject(task.projectId);
    if (savedProject) {
      project = {
        id: savedProject.id,
        name: savedProject.name,
        ...(savedProject.color ? { color: savedProject.color } : {}),
      };
      projectPath = savedProject.path;
      application = await getApplication(task.applicationId);
      filePreview = await readTaskFile(savedProject.path, task.filePath);
    }
  } catch (caughtError) {
    console.error("Unable to render task", caughtError);
    error = caughtError instanceof TaskStoreError
      ? "Task data could not be read. Check data/tasks.json and reload this page."
      : caughtError instanceof ProjectStoreError
        ? "Project data could not be read. Check data/projects.json and reload this page."
        : caughtError instanceof ApplicationStoreError
          ? "Application data could not be read. Check data/applications.json and reload this page."
          : "Task details could not be loaded. Reload this page and try again.";
  }

  if (!error && !task) {
    notFound();
  }

  if (error || !task) {
    return (
      <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-3xl">
          <BrandBar />
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Task unavailable</h1>
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <TaskDetail
      key={task.id}
      task={task}
      project={project}
      filePreview={filePreview}
      projectPath={projectPath}
      application={application}
    />
  );
}
