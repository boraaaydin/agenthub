import {
  getRemoteAccessAction,
  type RemoteAccessActionId,
  type TailscaleInstallSupport,
  type TailscalePlatform,
} from "../src/lib/remote-access";
import { resolveTailscaleCli } from "./tailscale-cli";
import { resolveWingetCli } from "./winget-cli";

const MACOS_INSTALL_COMMAND = "brew install --cask tailscale-app";

type SetupCommand = {
  command: string;
  args: string[];
};

export async function getSetupCommand(actionId: RemoteAccessActionId): Promise<SetupCommand> {
  const action = getRemoteAccessAction(actionId);

  switch (action.id) {
    case "tailscale-install":
      return getTailscaleInstallCommand();
    case "tailscale-connect": {
      const cliPath = await resolveTailscaleCli();
      if (!cliPath) {
        throw new Error("Tailscale is not installed. Install it before connecting.");
      }
      return { command: cliPath, args: ["up"] };
    }
  }
}

export async function getTailscaleInstallSupport(): Promise<TailscaleInstallSupport> {
  if (process.platform !== "win32") {
    return { kind: "automated" };
  }

  const wingetCli = await resolveWingetCli();
  return wingetCli ? { kind: "automated" } : { kind: "manual" };
}

export function getTailscalePlatform(): TailscalePlatform {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    case "linux":
      return "linux";
    default:
      return "other";
  }
}

async function getTailscaleInstallCommand(): Promise<SetupCommand> {
  switch (process.platform) {
    case "darwin":
      return shellCommand(MACOS_INSTALL_COMMAND);
    case "win32": {
      const wingetCli = await resolveWingetCli();
      if (!wingetCli) {
        throw new Error("winget is not available. Download Tailscale and install it manually.");
      }
      return {
        command: wingetCli,
        args: [
          "install",
          "--id",
          "Tailscale.Tailscale",
          "-e",
          "--accept-package-agreements",
          "--accept-source-agreements",
        ],
      };
    }
    default:
      return shellCommand("curl -fsSL https://tailscale.com/install.sh | sh");
  }
}

function shellCommand(command: string): SetupCommand {
  return { command: "/bin/sh", args: ["-lc", command] };
}
