"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  workitemStatusBadgeClass,
  workitemStatusLabel,
  type WorkitemDependency,
  type WorkitemStatus,
} from "@/lib/workitem-filters";

type SearchResponse = { workitems?: WorkitemDependency[]; error?: string };

const NO_EXCLUDED_STATUSES: readonly WorkitemStatus[] = [];

type WorkitemDependencyPickerProps = {
  projectId: string;
  selectedDependencies: WorkitemDependency[];
  onChange: (dependencies: WorkitemDependency[]) => void;
  currentWorkitemId?: number;
  excludedStatuses?: readonly WorkitemStatus[];
  disabled?: boolean;
};

export function WorkitemDependencyPicker({
  projectId,
  selectedDependencies,
  onChange,
  currentWorkitemId,
  excludedStatuses: requestedExcludedStatuses,
  disabled = false,
}: WorkitemDependencyPickerProps) {
  const listboxId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<WorkitemDependency[]>([]);
  const [suggestionProjectId, setSuggestionProjectId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const excludedStatuses = requestedExcludedStatuses ?? NO_EXCLUDED_STATUSES;
  const selectedIds = new Set(selectedDependencies.map((dependency) => dependency.id));
  const candidates = (suggestionProjectId === projectId ? suggestions : []).filter((candidate) => (
    candidate.id !== currentWorkitemId && !selectedIds.has(candidate.id)
  ));
  const safeActiveIndex = candidates.length === 0 ? -1 : Math.min(activeIndex, candidates.length - 1);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const searchParams = new URLSearchParams({ q: query });
      for (const status of excludedStatuses) {
        searchParams.append("excludeStatus", status);
      }

      setState("loading");
      void fetch(`/api/projects/${encodeURIComponent(projectId)}/workitems?${searchParams}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await response.json() as SearchResponse;
          if (!response.ok) {
            throw new Error(body.error ?? "Unable to search workitems.");
          }
          setSuggestions(body.workitems ?? []);
          setSuggestionProjectId(projectId);
          setState("idle");
          setActiveIndex(0);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            return;
          }
          console.error("Unable to search workitems", error);
          setSuggestions([]);
          setSuggestionProjectId(projectId);
          setState("error");
          setActiveIndex(-1);
        });
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [excludedStatuses, projectId, query]);


  function selectDependency(dependency: WorkitemDependency) {
    onChange([...selectedDependencies, dependency]);
    setQuery("");
    setIsOpen(true);
  }

  function removeDependency(id: number) {
    onChange(selectedDependencies.filter((dependency) => dependency.id !== id));
  }

  function closeDropdown() {
    closeTimer.current = setTimeout(() => setIsOpen(false), 100);
  }

  function openDropdown() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
    setIsOpen(true);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => Math.min(index + 1, candidates.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => Math.max(0, Math.min(index - 1, candidates.length - 1)));
      return;
    }
    if (event.key === "Enter" && isOpen && candidates[safeActiveIndex]) {
      event.preventDefault();
      selectDependency(candidates[safeActiveIndex]);
      return;
    }
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key === "Backspace" && !query && selectedDependencies.length > 0) {
      removeDependency(selectedDependencies[selectedDependencies.length - 1].id);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-800" htmlFor="workitem-dependencies">
        Dependencies
      </label>
      <p id="workitem-dependencies-help" className="mt-1 text-sm leading-6 text-slate-600">
        Choose workitems in this project that must be completed or cancelled first.
      </p>
      <div className="relative mt-2">
        <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 focus-within:border-sky-600 focus-within:ring-3 focus-within:ring-sky-100">
          {selectedDependencies.map((dependency) => (
            <span key={dependency.id} className="inline-flex items-center gap-1 rounded-lg bg-sky-50 py-1 pl-2 text-xs font-medium text-sky-900">
              #{dependency.id} · {dependency.title}
              <button
                type="button"
                onClick={() => removeDependency(dependency.id)}
                disabled={disabled}
                aria-label={`Remove dependency #${dependency.id}: ${dependency.title}`}
                className="rounded p-0.5 text-sky-800 transition hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed"
              >
                <span aria-hidden="true">×</span>
              </button>
            </span>
          ))}
          <input
            id="workitem-dependencies"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={openDropdown}
            onBlur={closeDropdown}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-describedby="workitem-dependencies-help"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-activedescendant={isOpen && safeActiveIndex >= 0 ? `${listboxId}-${safeActiveIndex}` : undefined}
            autoComplete="off"
            disabled={disabled || !projectId}
            placeholder={selectedDependencies.length === 0 ? "Search by title or #id" : "Add another dependency"}
            className="h-7 min-w-40 flex-1 border-0 bg-transparent px-0 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          />
        </div>
        {isOpen && projectId && !disabled && (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Workitem dependencies"
            onMouseDown={(event) => event.preventDefault()}
            className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          >
            {state === "loading" ? (
              <p role="status" className="px-3 py-2 text-sm text-slate-600">Searching workitems…</p>
            ) : state === "error" ? (
              <p role="alert" className="px-3 py-2 text-sm text-red-700">Unable to search workitems. Try again.</p>
            ) : candidates.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-600">No matching workitems.</p>
            ) : candidates.map((candidate, index) => (
              <button
                key={candidate.id}
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === safeActiveIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectDependency(candidate)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  index === safeActiveIndex ? "bg-sky-50 text-sky-950" : "text-sky-950 hover:bg-slate-50"
                }`}
              >
                <span className="font-medium tabular-nums">#{candidate.id}</span>
                <span className="min-w-0 flex-1 truncate">{candidate.title}</span>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${workitemStatusBadgeClass(candidate.status)}`}>
                  {workitemStatusLabel(candidate.status)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
