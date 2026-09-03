type TaskFilePreviewProps = {
  filePath: string;
  projectPath: string | null;
  result:
    | { status: "ok"; content: string }
    | { status: "not-found" }
    | { status: "too-large" }
    | { status: "invalid-path" }
    | { status: "error"; message: string }
    | { status: "missing-project" };
};

export function TaskFilePreview({ filePath, projectPath, result }: TaskFilePreviewProps) {
  const repositoryPath = projectPath ? `${projectPath}/${filePath}` : filePath;

  return (
    <section className="mt-10 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="task-file">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="task-file" className="text-lg font-semibold text-slate-900">Task file</h2>
          <p className="mt-1 break-all font-mono text-xs leading-5 text-slate-600">{repositoryPath}</p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Read-only</span>
      </div>
      {result.status === "ok" ? (
        <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-800">{result.content}</pre>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          {result.status === "not-found" && <>The task file was not found at <span className="font-mono text-xs">{repositoryPath}</span>.</>}
          {result.status === "too-large" && "This task file is too large to preview (maximum 512 KB)."}
          {result.status === "invalid-path" && "This path is outside the project directory and cannot be previewed."}
          {result.status === "missing-project" && "The project record is missing, so this task file cannot be located."}
          {result.status === "error" && result.message}
        </p>
      )}
    </section>
  );
}
