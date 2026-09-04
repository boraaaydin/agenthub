import type { SessionCompletion } from "./session-completion";

export const BUILT_IN_ALLOWED_IP_RANGES = [
  { range: "127.0.0.0/8", label: "This machine (IPv4 loopback)" },
  { range: "::1", label: "This machine (IPv6 loopback)" },
  { range: "100.64.0.0/10", label: "Tailscale (IPv4 CGNAT)" },
  { range: "fd7a:115c:a1e0::/48", label: "Tailscale (IPv6)" },
] as const;

export const REMOTE_ACCESS_METHODS = [
  { id: "tailscale", label: "Tailscale" },
] as const;

export type RemoteAccessMethod = (typeof REMOTE_ACCESS_METHODS)[number];
export type RemoteAccessMethodId = RemoteAccessMethod["id"];

type RemoteAccessActionDefinition = {
  id: string;
  methodId: RemoteAccessMethodId;
  label: string;
  completion: SessionCompletion;
};

export const REMOTE_ACCESS_ACTIONS = [
  {
    id: "tailscale-install",
    methodId: "tailscale",
    label: "Install Tailscale",
    completion: {
      closeOnExit: "on-success",
      success: {
        title: "Tailscale installed",
        message: "The installer finished and this setup session was closed.",
        action: {
          label: "Back to remote access",
          href: "/settings/remote-access",
        },
      },
      failure: {
        title: "Installation did not finish",
        message: "The installer did not complete. Review the terminal output for the reason, then try again.",
      },
    },
  },
  {
    id: "tailscale-connect",
    methodId: "tailscale",
    label: "Connect",
    completion: {
      closeOnExit: "on-success",
      success: {
        title: "Tailscale connected",
        message: "Tailscale finished connecting and this setup session was closed.",
        action: {
          label: "Back to remote access",
          href: "/settings/remote-access",
        },
      },
      failure: {
        title: "Tailscale did not connect",
        message: "Tailscale did not complete the connection. Review the terminal output for the reason, then try again.",
      },
    },
  },
] as const satisfies readonly RemoteAccessActionDefinition[];

export type RemoteAccessAction = (typeof REMOTE_ACCESS_ACTIONS)[number];
export type RemoteAccessActionId = RemoteAccessAction["id"];

export function isRemoteAccessMethodId(value: unknown): value is RemoteAccessMethodId {
  return REMOTE_ACCESS_METHODS.some((method) => method.id === value);
}

export function getRemoteAccessMethod(methodId: RemoteAccessMethodId): RemoteAccessMethod {
  return REMOTE_ACCESS_METHODS.find((method) => method.id === methodId)!;
}

export function isRemoteAccessActionId(value: unknown): value is RemoteAccessActionId {
  return REMOTE_ACCESS_ACTIONS.some((action) => action.id === value);
}

export function getRemoteAccessAction(actionId: RemoteAccessActionId): RemoteAccessAction {
  return REMOTE_ACCESS_ACTIONS.find((action) => action.id === actionId)!;
}
