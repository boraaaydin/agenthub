"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  BUILT_IN_ALLOWED_IP_RANGES,
  type RemoteAccessMethodId,
} from "@/lib/remote-access";

type ApiError = { error?: string };

type AllowedIpsSectionProps = {
  additionalAllowedIps: string[];
  methods: { id: RemoteAccessMethodId; enabled: boolean }[];
};

export default function AllowedIpsSection({
  additionalAllowedIps: savedAdditionalAllowedIps,
  methods,
}: AllowedIpsSectionProps) {
  const router = useRouter();
  const [entries, setEntries] = useState(savedAdditionalAllowedIps.join("\n"));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    const additionalAllowedIps = entries
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remoteAccess: { methods, additionalAllowedIps },
        }),
      });
      const body = await response.json() as ApiError;
      if (!response.ok) {
        setError(body.error ?? "Unable to save allowed IP addresses. Try again.");
        return;
      }

      setEntries(additionalAllowedIps.join("\n"));
      setSuccess("Allowed IP addresses saved.");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Allowed IP addresses</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          These ranges are always allowed and cannot be removed.
        </p>
      </div>

      <ul className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200">
        {BUILT_IN_ALLOWED_IP_RANGES.map((entry) => (
          <li key={entry.range} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
            <span className="font-medium text-slate-800">{entry.label}</span>
            <code className="text-slate-600">{entry.range}</code>
          </li>
        ))}
      </ul>

      <form onSubmit={save} className="mt-6 space-y-4" noValidate>
        <div>
          <label className="block text-sm font-medium text-slate-800" htmlFor="additional-allowed-ips">
            Additional allowed addresses
          </label>
          <textarea
            id="additional-allowed-ips"
            value={entries}
            onChange={(event) => {
              setEntries(event.target.value);
              setError("");
              setSuccess("");
            }}
            disabled={isSaving}
            rows={5}
            placeholder={"192.168.1.0/24\n10.0.0.5\nfd00::/64"}
            spellCheck={false}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enter one IPv4 or IPv6 address or CIDR range per line. Adding a range widens who can drive your agents.
          </p>
        </div>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSaving ? "Saving addresses…" : "Save allowed addresses"}
        </button>
      </form>
    </section>
  );
}
