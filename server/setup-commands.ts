import { getRemoteAccessAction, type RemoteAccessActionId } from "../src/lib/remote-access";
import { resolveTailscaleCli } from "./tailscale-cli";

const MACOS_INSTALL_COMMAND = "brew install --cask tailscale-app";

type SetupCommand = {
  command: string;
  args: string[];
};

export async function getSetupCommand(actionId: RemoteAccessActionId): Promise<SetupCommand> {
  const action = getRemoteAccessAction(actionId);

  switch (action.id) {
    case "tailscale-install":
      return shellCommand(
        process.platform === "darwin"
          ? MACOS_INSTALL_COMMAND
          : "curl -fsSL https://tailscale.com/install.sh | sh",
      );
    case "tailscale-connect": {
      const cliPath = await resolveTailscaleCli();
      if (!cliPath) {
        throw new Error("Tailscale is not installed. Install it before connecting.");
      }
      return { command: cliPath, args: ["up"] };
    }
  }
}

function shellCommand(command: string): SetupCommand {
  return { command: "/bin/sh", args: ["-lc", command] };
}
