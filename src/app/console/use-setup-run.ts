"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type RefObject } from "react";

import { isRemoteAccessActionId, type RemoteAccessActionId } from "@/lib/remote-access";

type Options = {
  setupActionRef: RefObject<string | null>;
  connected: boolean;
  terminalReady: boolean;
  setError: (message: string) => void;
  startSetup: (action: RemoteAccessActionId) => boolean;
};

export function useSetupRun({
  setupActionRef,
  connected,
  terminalReady,
  setError,
  startSetup,
}: Options) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    const action = setupActionRef.current;
    if (!action || started.current) {
      return;
    }

    if (!isRemoteAccessActionId(action)) {
      started.current = true;
      setError("That remote access setup action is not available.");
      router.replace("/console");
      return;
    }
    if (!connected || !terminalReady) {
      return;
    }

    started.current = true;
    if (!startSetup(action)) {
      setError("The terminal connection is not ready. Try again in a moment.");
    }
    router.replace("/console");
  }, [connected, router, setError, setupActionRef, startSetup, terminalReady]);
}
