"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { SETTINGS_PROMPTS, type SettingsPromptField } from "@/lib/settings-prompts";

type ApiError = { error?: string };

type PromptFormProps = {
  field: SettingsPromptField;
  value: string;
};

export default function PromptForm({ field, value }: PromptFormProps) {
  const router = useRouter();
  const prompt = SETTINGS_PROMPTS.find((item) => item.field === field)!;
  const [content, setContent] = useState(value);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: content }),
      });
      const body = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(body.error ?? "Unable to save settings. Try again.");
        return;
      }

      setSuccess("Settings saved.");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.025em] text-slate-900">{prompt.title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{prompt.description}</p>
      </div>

      <label className="mt-6 block text-sm font-medium text-slate-800" htmlFor={field}>
        Prompt text
      </label>
      <textarea
        id={field}
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setError("");
          setSuccess("");
        }}
        disabled={isSubmitting}
        spellCheck={false}
        className="mt-2 min-h-[58vh] w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "Saving settings…" : "Save settings"}
        </button>
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </p>
        )}
      </div>
    </form>
  );
}
