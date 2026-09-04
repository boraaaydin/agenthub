"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { REMOTE_ACCESS_METHODS, type RemoteAccessMethodId } from "@/lib/remote-access";

type TailscaleStatus =
  | { state: "not-installed" }
  | { state: "needs-login" }
  | { state: "stopped" }
  | { state: "connected"; hostname: string; dnsName: string; ipv4: string }
  | { state: "unknown"; message: string };

type ApiError = { error?: string };

type RemoteAccessFormProps = {
  methods: { id: RemoteAccessMethodId; enabled: boolean }[];
  tailscaleStatus: TailscaleStatus;
  port: string;
};

export default function RemoteAccessForm({ methods, tailscaleStatus, port }: RemoteAccessFormProps) {
  const router = useRouter();
  const [enabledMethods, setEnabledMethods] = useState(methods);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedUrl, setCopiedUrl] = useState("");

  async function toggleMethod(methodId: RemoteAccessMethodId) {
    const nextMethods = enabledMethods.map((method) => (
      method.id === methodId ? { ...method, enabled: !method.enabled } : method
    ));
    setEnabledMethods(nextMethods);
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remoteAccess: { methods: nextMethods } }),
      });
      const body = await response.json() as ApiError;
      if (!response.ok) {
        setEnabledMethods(enabledMethods);
        setError(body.error ?? "Unable to save remote access settings. Try again.");
        return;
      }
      setSuccess("Remote access settings saved.");
      router.refresh();
    } catch {
      setEnabledMethods(enabledMethods);
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
    } catch {
      setError("Could not copy the URL. Select it and copy it manually.");
    }
  }

  function refreshStatus() {
    setError("");
    setSuccess("");
    setIsRefreshing(true);
    router.refresh();
    window.setTimeout(() => setIsRefreshing(false), 300);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-slate-900">Remote access</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Make this local AgentHub available to devices you trust.</p>
        </div>
        <button
          type="button"
          onClick={refreshStatus}
          disabled={isRefreshing}
          className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {isRefreshing ? "Refreshing…" : "Refresh status"}
        </button>
      </div>

      {REMOTE_ACCESS_METHODS.map((method) => {
        const enabled = enabledMethods.find((entry) => entry.id === method.id)?.enabled ?? false;
        return (
          <section key={method.id} className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{method.label}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">A private network that reaches this machine without exposing it publicly.</p>
              </div>
              <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
                <span>Enabled</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={isSaving}
                  onChange={() => toggleMethod(method.id)}
                  className="h-5 w-5 rounded border-slate-300 text-sky-700 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed"
                />
              </label>
            </div>

            <TailscaleDetails status={tailscaleStatus} port={port} copiedUrl={copiedUrl} onCopy={copyUrl} />
          </section>
        );
      })}

      <aside className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
        <strong>No authentication is added.</strong> Anyone who can reach this port can drive your agents. Your tailnet is the only boundary, and AgentHub listens on every network interface—not only the Tailscale address.
      </aside>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}
    </div>
  );
}

function TailscaleDetails({
  status,
  port,
  copiedUrl,
  onCopy,
}: {
  status: TailscaleStatus;
  port: string;
  copiedUrl: string;
  onCopy: (url: string) => void;
}) {
  if (status.state === "connected") {
    const urls = [`http://${status.dnsName}:${port}`, `http://${status.ipv4}:${port}`];
    return (
      <div className="mt-6 border-t border-slate-200 pt-5">
        <p className="font-medium text-emerald-800">Connected to {status.hostname}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Open either address from another device on your tailnet.</p>
        <ul className="mt-4 space-y-2">
          {urls.map((url) => (
            <li key={url} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
              <code className="break-all text-sm text-slate-800">{url}</code>
              <button type="button" onClick={() => onCopy(url)} className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100">
                {copiedUrl === url ? "Copied" : "Copy"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (status.state === "not-installed") {
    return <SetupState message="Tailscale is not installed on this machine." action="tailscale-install" label="Install Tailscale" />;
  }
  if (status.state === "needs-login") {
    return <SetupState message="Tailscale is installed but needs you to sign in or approve this machine." action="tailscale-connect" label="Connect" />;
  }
  if (status.state === "stopped") {
    return <SetupState message="Tailscale is installed but currently stopped." action="tailscale-connect" label="Connect" />;
  }
  return <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{status.message}</p>;
}

function SetupState({ message, action, label }: { message: string; action: string; label: string }) {
  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <p className="text-sm leading-6 text-slate-600">{message}</p>
      <Link href={`/console?setup=${action}`} className="mt-4 inline-flex h-10 items-center rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200">
        {label}
      </Link>
    </div>
  );
}
