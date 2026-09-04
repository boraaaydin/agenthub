export const REMOTE_ACCESS_METHODS = [
  { id: "tailscale", label: "Tailscale" },
] as const;

export type RemoteAccessMethod = (typeof REMOTE_ACCESS_METHODS)[number];
export type RemoteAccessMethodId = RemoteAccessMethod["id"];

export const REMOTE_ACCESS_ACTIONS = [
  { id: "tailscale-install", methodId: "tailscale", label: "Install Tailscale" },
  { id: "tailscale-connect", methodId: "tailscale", label: "Connect" },
] as const;

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
