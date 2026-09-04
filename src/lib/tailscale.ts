import "server-only";

import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { resolveTailscaleCli } from "../../server/tailscale-cli";

const execFile = promisify(execFileCallback);
const COMMAND_TIMEOUT_MS = 5_000;

type TailscaleStatusJson = {
  BackendState?: unknown;
  Self?: {
    HostName?: unknown;
    DNSName?: unknown;
    TailscaleIPs?: unknown;
  };
};

export type TailscaleStatus =
  | { state: "not-installed" }
  | { state: "needs-login" }
  | { state: "stopped" }
  | { state: "connected"; hostname: string; dnsName: string; ipv4: string }
  | { state: "unknown"; message: string };

export async function readTailscaleStatus(): Promise<TailscaleStatus> {
  try {
    const command = await resolveTailscaleCli();
    if (!command) {
      return { state: "not-installed" };
    }

    const { stdout } = await execFile(command, ["status", "--json"], {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 1_000_000,
    });
    return statusFromJson(JSON.parse(stdout) as TailscaleStatusJson);
  } catch (error) {
    return { state: "unknown", message: failureMessage(error) };
  }
}

function statusFromJson(status: TailscaleStatusJson): TailscaleStatus {
  switch (status.BackendState) {
    case "NeedsLogin":
    case "NeedsMachineAuth":
      return { state: "needs-login" };
    case "Stopped":
      return { state: "stopped" };
    case "Running": {
      const hostname = typeof status.Self?.HostName === "string" ? status.Self.HostName : "";
      const dnsName = typeof status.Self?.DNSName === "string"
        ? status.Self.DNSName.replace(/\.$/, "")
        : "";
      const ipv4 = Array.isArray(status.Self?.TailscaleIPs)
        ? status.Self.TailscaleIPs.find((ip): ip is string => typeof ip === "string" && !ip.includes(":")) ?? ""
        : "";

      if (hostname && dnsName && ipv4) {
        return { state: "connected", hostname, dnsName, ipv4 };
      }
      return { state: "unknown", message: "Tailscale is running, but did not report a hostname and IPv4 address." };
    }
    case "Starting":
    case "NoState":
      return { state: "unknown", message: "Tailscale is still starting. Refresh status in a moment." };
    default:
      return { state: "unknown", message: "Tailscale returned an unrecognized status." };
  }
}

function failureMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `Tailscale status could not be read: ${error.message}`;
  }
  return "Tailscale status could not be read.";
}
