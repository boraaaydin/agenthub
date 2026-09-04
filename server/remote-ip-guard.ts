import { readSettings } from "../src/lib/settings-store";
import { createIpAllowlist, isAllowedAddress } from "./ip-allowlist";

let allowlist = createIpAllowlist();

export async function refreshRemoteIpAllowlist(): Promise<void> {
  try {
    const settings = await readSettings();
    allowlist = createIpAllowlist(settings.remoteAccess.additionalAllowedIps);
  } catch (error) {
    console.error("Unable to refresh the remote IP allowlist; allowing only built-in ranges.", error);
    allowlist = createIpAllowlist();
  }
}

export function isAllowedRemoteAddress(address: string | undefined): boolean {
  return isAllowedAddress(allowlist, address);
}
