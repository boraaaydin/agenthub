"use client";

import { useRouter } from "next/navigation";

import {
  PLAN_STATUSES,
  PLAN_STATUS_LABELS,
  plansHref,
  type PlanFilterStatus,
} from "@/lib/plan-filters";

type StatusFilterProps = {
  projectId: string;
  selectedStatus: PlanFilterStatus;
};

export function StatusFilter({ projectId, selectedStatus }: StatusFilterProps) {
  const router = useRouter();

  function changeStatus(status: PlanFilterStatus) {
    router.push(plansHref({ projectId, status }));
  }

  return (
    <div className="sm:max-w-xs">
      <label className="block text-sm font-medium text-slate-800" htmlFor="plan-status-filter">
        Status
      </label>
      <select
        id="plan-status-filter"
        value={selectedStatus}
        onChange={(event) => changeStatus(event.target.value as PlanFilterStatus)}
        className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100"
      >
        <option value="active">Active</option>
        <option value="all">All</option>
        {PLAN_STATUSES.map((status) => (
          <option key={status} value={status}>{PLAN_STATUS_LABELS[status]}</option>
        ))}
      </select>
    </div>
  );
}
