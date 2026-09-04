import Link from "next/link";

import {
  workitemStatusBadgeClass,
  workitemStatusLabel,
  type WorkitemDependency,
} from "@/lib/workitem-filters";

type WorkitemDependencySummaryProps = {
  projectId: string;
  dependencies: WorkitemDependency[];
  blockingDependencies: WorkitemDependency[];
};

export function WorkitemDependencySummary({
  projectId,
  dependencies,
  blockingDependencies,
}: WorkitemDependencySummaryProps) {
  if (dependencies.length === 0) {
    return (
      <section className="mt-5" aria-labelledby="workitem-dependencies-summary">
        <h2 id="workitem-dependencies-summary" className="text-sm font-semibold text-slate-900">Dependencies</h2>
        <p className="mt-1 text-sm text-slate-600">This workitem has no dependencies.</p>
      </section>
    );
  }

  return (
    <section className="mt-5" aria-labelledby="workitem-dependencies-summary">
      <h2 id="workitem-dependencies-summary" className="text-sm font-semibold text-slate-900">Dependencies</h2>
      {blockingDependencies.length > 0 && (
        <p className="mt-1 text-sm text-amber-800">
          Create task is unavailable until the unfinished dependencies are completed or cancelled.
        </p>
      )}
      <ul className="mt-2 space-y-2">
        {dependencies.map((dependency) => {
          const isBlocking = blockingDependencies.some((blocking) => blocking.id === dependency.id);
          return (
            <li key={dependency.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                href={`/projects/${encodeURIComponent(projectId)}/workitems/${dependency.id}`}
                className="font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
              >
                #{dependency.id} · {dependency.title}
              </Link>
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${workitemStatusBadgeClass(dependency.status)}`}>
                {workitemStatusLabel(dependency.status)}
              </span>
              {isBlocking && <span className="text-xs font-medium text-amber-800">Blocking</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
