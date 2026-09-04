export const CLIENT_ORIGIN_HEADER = "x-agenthub-client-origin";

export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) {
    return false;
  }

  return address === "::1"
    || /^127(?:\.\d{1,3}){3}$/.test(address)
    || /^::ffff:127(?:\.\d{1,3}){3}$/.test(address);
}

export function isLocalClient(headers: Headers): boolean {
  return headers.get(CLIENT_ORIGIN_HEADER) === "local";
}

export function requireLocalClient(request: Request): Response | null {
  return isLocalClient(request.headers)
    ? null
    : Response.json(
      { error: "This action is only available on the machine running AgentHub." },
      { status: 403 },
    );
}
