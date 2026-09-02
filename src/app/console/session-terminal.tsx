"use client";

import "@xterm/xterm/css/xterm.css";

import type { Terminal } from "@xterm/xterm";
import { useEffect, type MutableRefObject, type RefObject } from "react";

type SessionTerminalProps = {
  hostRef: RefObject<HTMLDivElement | null>;
  terminalRef: MutableRefObject<Terminal | null>;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onReady: () => void;
};

export function SessionTerminal({
  hostRef,
  terminalRef,
  onInput,
  onResize,
  onReady,
}: SessionTerminalProps) {
  useEffect(() => {
    let disposed = false;
    let terminal: Terminal | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let inputSubscription: { dispose: () => void } | null = null;

    async function createTerminal() {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !hostRef.current) {
        return;
      }

      const newTerminal = new Terminal({
        allowProposedApi: false,
        cursorBlink: true,
        cursorStyle: "bar",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 13,
        lineHeight: 1.35,
        scrollback: 10_000,
        theme: {
          background: "#0b1220",
          foreground: "#dce7f5",
          cursor: "#8ac5ff",
          selectionBackground: "#29486b",
        },
      });
      const fitAddon = new FitAddon();
      newTerminal.loadAddon(fitAddon);
      newTerminal.open(hostRef.current);
      terminal = newTerminal;
      terminalRef.current = newTerminal;

      const fit = () => {
        fitAddon.fit();
        onResize(newTerminal.cols, newTerminal.rows);
      };
      fit();
      resizeObserver = new ResizeObserver(fit);
      resizeObserver.observe(hostRef.current);
      inputSubscription = newTerminal.onData(onInput);
      onReady();
    }

    void createTerminal();
    return () => {
      disposed = true;
      inputSubscription?.dispose();
      resizeObserver?.disconnect();
      terminal?.dispose();
      terminalRef.current = null;
    };
  }, [hostRef, onInput, onReady, onResize, terminalRef]);

  return (
    <div
      ref={hostRef}
      onClick={() => terminalRef.current?.focus()}
      className="h-[420px] cursor-text p-2 sm:h-[500px]"
      aria-label="Live agent terminal output"
      role="log"
    />
  );
}
