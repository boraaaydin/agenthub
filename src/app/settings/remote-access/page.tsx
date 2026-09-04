import { headers } from "next/headers";

import RemoteAccessForm from "./remote-access-form";
import { getTailscaleInstallSupport, getTailscalePlatform } from "../../../../server/setup-commands";
import { getTailscaleDownload } from "@/lib/remote-access";
import { isLocalClient } from "@/lib/request-origin";
import { defaultSettings, readSettings, SettingsStoreError } from "@/lib/settings-store";
import { readTailscaleStatus } from "@/lib/tailscale";

export const dynamic = "force-dynamic";

export default async function RemoteAccessPage() {
  const canManage = isLocalClient(await headers());
  let settings = defaultSettings();
  let error = "";

  try {
    settings = await readSettings();
  } catch (caughtError) {
    console.error("Unable to render remote access settings", caughtError);
    error = caughtError instanceof SettingsStoreError
      ? "Settings could not be read. Check data/settings.json, then save valid settings to replace it."
      : "Settings could not be loaded. Reload this page and try again.";
  }

  const [tailscaleStatus, tailscaleInstallSupport] = await Promise.all([
    readTailscaleStatus(),
    getTailscaleInstallSupport(),
  ]);
  const tailscaleDownload = getTailscaleDownload(getTailscalePlatform());

  return (
    <>
      {error && <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <RemoteAccessForm
        methods={settings.remoteAccess.methods}
        additionalAllowedIps={settings.remoteAccess.additionalAllowedIps}
        tailscaleStatus={tailscaleStatus}
        tailscaleInstallSupport={tailscaleInstallSupport}
        tailscaleDownload={tailscaleDownload}
        port={process.env.PORT ?? "3000"}
        canManage={canManage}
      />
    </>
  );
}
