# Restrict incoming connections to localhost and Tailscale IP ranges

---
**Execution Guidelines**: Before starting this task, ensure you've read `.agent/commands/tasks/do-task.md` (if not already read in this session). This file contains essential guidelines on how to properly execute tasks, including dependency checking, verification steps, and archival procedures.

**Application-specific documentation**: This repository is a single application; there is no `apps/{APP_NAME}/` directory. Read `.agent/PROJECT_DOCUMENT.md` before starting the task — it contains the tech stack, conventions, and verification steps.

When this task file is read standalone, the agent should:
1. Check if `do-task.md` has been read in the current session
2. If not, read it first to understand the execution workflow
3. Read `.agent/PROJECT_DOCUMENT.md` before starting the task
4. Then proceed with this specific task
---

## Description

AgentHub listens on every network interface (`httpServer.listen(port)` in `server.ts`) and adds no
authentication, so a misconfigured network — a router that forwards the port, a public Wi-Fi
interface, a wrong firewall rule — exposes a control panel that can drive agent CLIs on the
developer's machine.

Add a source-IP guard in front of **every** incoming connection: only the loopback addresses and
the Tailscale ranges (IPv4 CGNAT `100.64.0.0/10` and the Tailscale IPv6 ULA `fd7a:115c:a1e0::/48`)
are served. Every other remote address gets `403` for HTTP requests and a destroyed socket for
WebSocket upgrades. On top of that built-in allowlist, the user can define **additional** allowed
IP addresses or CIDR ranges in settings (for example a home LAN range), managed on
`/settings/remote-access`.

## Application

agenthub (repository root — this project has no `apps/` directory)

## GitHub Issue

- Issue #38

## Dependencies

None - This task is independent

## Context

### Clarified decisions (already agreed with the user — do not re-ask)

| Question | Decision |
| --- | --- |
| Is the restriction optional? | **No.** It is always on and cannot be turned off. There is no enable/disable switch anywhere in settings or in the environment. |
| What does the settings list do? | It only **adds** ranges. The built-in loopback and Tailscale ranges are hardcoded and always allowed, so the user can never lock themselves out from the local machine. |
| IPv6? | **Supported.** `::1`, the Tailscale ULA range `fd7a:115c:a1e0::/48`, and IPv4-mapped IPv6 addresses (`::ffff:100.x.x.x`) are all handled. |

Consequence to accept knowingly: after this change, reaching AgentHub over a plain LAN address
(`192.168.x.x`, `10.x.x.x`) stops working until that range is added on `/settings/remote-access`
from the local machine. This is intended.

### Where the guard must live

There is **no** `middleware.ts` in this repository, and a Next.js middleware would not be enough
even if there were: the WebSocket upgrade for `/api/agent-socket` is handled by the custom server
in `server.ts` and never passes through Next.js. The guard therefore belongs in `server.ts`, in
both entry points:

- the `createServer((request, response) => …)` handler — covers every page, asset and Route
  Handler, because they all reach Next.js through `handle`;
- the `httpServer.on("upgrade", …)` listener — covers the agent WebSocket **and** the Next.js dev
  HMR upgrade, so the guard must run at the very top of that listener, before the
  `url.pathname !== "/api/agent-socket"` early return.

The remote address comes from `request.socket.remoteAddress`.

### Existing pieces to reuse

| File | Why it matters |
| --- | --- |
| `server.ts` | Both entry points; also performs an internal `fetch` to `http://127.0.0.1:${port}/api/tasks/{id}` in `markExitedExecutionTaskExecuted`, which must keep working (loopback is allowed). |
| `src/lib/settings-store.ts` | `Settings.remoteAccess` already exists (`RemoteAccessSettings`), with `parseRemoteAccess` for reading `data/settings.json` and `validateRemoteAccess` for validating `PUT /api/settings` input. Extend both. |
| `src/lib/remote-access.ts` | Client-safe catalog (`REMOTE_ACCESS_METHODS`, `REMOTE_ACCESS_ACTIONS`). The built-in range list belongs here as display data — it must stay importable by client components, so no `node:` imports. |
| `src/lib/workitem-events.ts` | The exact pub/sub pattern to copy for settings-change notification (globalThis symbol registry + `publish…` / `subscribeTo…` returning an unsubscribe function). `server.ts` already consumes it via `subscribeToWorkitemChanges`. |
| `server/tailscale-cli.ts`, `src/lib/tailscale.ts` | Show the convention: server-only helpers live under `server/`, and `src/lib/*` server modules import them with a relative `../../server/…` path. |
| `src/app/settings/remote-access/page.tsx` + `remote-access-form.tsx` | Where the UI goes; the form already saves through `PUT /api/settings` with `router.refresh()` and error/success banners. |
| `src/app/settings/projects/projects-settings-form.tsx` | Reference for a plain `<form onSubmit>` settings form with a submit button (the remote-access form currently only has instant-save toggles). |

## Acceptance Criteria

- [ ] A request from a non-allowed remote address to any URL (page, `/_next/*` asset or
      `/api/*` Route Handler) is answered with `403` and a short plain-text body; Next.js never
      handles it.
- [ ] A WebSocket upgrade from a non-allowed remote address is refused: the socket is destroyed
      before `socketServer.handleUpgrade`, and before the `/api/agent-socket` path check, so
      Next.js dev HMR upgrades are covered too.
- [ ] Requests from `127.0.0.1`, `::1` and `::ffff:127.0.0.1` are always served, whatever is in
      `data/settings.json`.
- [ ] Requests from `100.64.0.0/10` (including the `::ffff:100.x.x.x` form) and from
      `fd7a:115c:a1e0::/48` are always served.
- [ ] A request whose `remoteAddress` is missing or unparseable is refused.
- [ ] `data/settings.json` gains `remoteAccess.additionalAllowedIps` (a string array, default
      `[]`); an address or CIDR listed there is served in addition to the built-in ranges.
- [ ] `PUT /api/settings` rejects a malformed entry with a `400` and a specific message, and
      accepts both bare addresses (`10.0.0.5`, `fd00::1`) and CIDRs (`192.168.1.0/24`, `fd00::/64`).
- [ ] Saving the list takes effect for the next request without restarting the server.
- [ ] `/settings/remote-access` shows the built-in always-allowed ranges as a read-only list and
      an editable field for the additional entries, with save/error/success feedback matching the
      other settings screens.
- [ ] The amber warning box on `/settings/remote-access` no longer claims AgentHub accepts
      traffic from every network interface; it states the new boundary and that no authentication
      is added within it.
- [ ] `.agent/PROJECT_DOCUMENT.md` is updated (architecture, open decisions, repository
      structure, delivered capabilities) to describe the guard and the settings field.
- [ ] `pnpm build` succeeds and `pnpm lint` is clean.
- [ ] No new npm dependency is added.

## Technical Notes

### Use `node:net` `BlockList` — do not hand-roll CIDR maths

Node's built-in `net.BlockList` does subnet matching, including IPv4-mapped IPv6 addresses, and
`net.isIP` / `net.isIPv4` / `net.isIPv6` validate input. No package is needed, and no bit
arithmetic should be written by hand.

Build the allowlist once and reuse the instance:

```ts
const allowList = new net.BlockList();
allowList.addSubnet("127.0.0.0", 8, "ipv4");        // loopback
allowList.addAddress("::1", "ipv6");                 // loopback, IPv6
allowList.addSubnet("100.64.0.0", 10, "ipv4");       // Tailscale CGNAT
allowList.addSubnet("fd7a:115c:a1e0::", 48, "ipv6"); // Tailscale ULA
```

Normalize the address before checking it:

1. Strip an IPv6 zone index (`fe80::1%en0` → `fe80::1`).
2. Rewrite an IPv4-mapped address (`::ffff:100.101.102.103`) to its IPv4 form, then check it as
   `"ipv4"`. Do not rely on `BlockList`'s implicit mapping — being explicit keeps the behaviour
   obvious and testable.
3. Pick the check family with `net.isIPv4` / `net.isIPv6`; if neither matches, refuse.

### New and changed files

| File | Change |
| --- | --- |
| `server/ip-allowlist.ts` | **New, server-only.** Address normalization, `BlockList` construction from the built-in ranges plus a list of extra entries, `isAllowedAddress(address: string \| undefined): boolean`, and `validateIpRange(entry: string): string` (returns the normalized entry or throws) used by settings validation. |
| `server/remote-ip-guard.ts` | **New, server-only.** Holds the current `BlockList` in a module variable. `refreshRemoteIpAllowlist(): Promise<void>` reads settings and rebuilds it; `isAllowedRemoteAddress(address)` is a synchronous lookup used by both `server.ts` entry points. If reading settings fails, log the error and keep only the built-in ranges — never fall open. |
| `src/lib/settings-events.ts` | **New, client-safe pub/sub** mirroring `src/lib/workitem-events.ts`: `publishSettingsChange()` / `subscribeToSettingsChanges(listener)` returning an unsubscribe function, backed by a `Symbol.for("agenthub.settingsEvents")` registry on `globalThis`. |
| `src/lib/settings-store.ts` | Add `additionalAllowedIps: string[]` to `RemoteAccessSettings`, default `[]` in `defaultSettings()`, strict parsing in `parseRemoteAccess`, validation in `validateRemoteAccess`, and a `publishSettingsChange()` call after a successful `writeDocument` in `saveSettings`. |
| `src/lib/remote-access.ts` | Add a client-safe `BUILT_IN_ALLOWED_IP_RANGES` constant: `[{ range: "127.0.0.0/8", label: "This machine (IPv4 loopback)" }, { range: "::1", label: "This machine (IPv6 loopback)" }, { range: "100.64.0.0/10", label: "Tailscale (IPv4 CGNAT)" }, { range: "fd7a:115c:a1e0::/48", label: "Tailscale (IPv6)" }]`. Display data only — the enforcement list lives in `server/ip-allowlist.ts`; keep the two in sync. |
| `server.ts` | Guard both entry points; `await refreshRemoteIpAllowlist()` inside `app.prepare().then(…)` before `httpServer.listen`; subscribe to settings changes and refresh, and unsubscribe in `shutdown()` next to `unsubscribeFromWorkitemChanges()`. |
| `src/app/settings/remote-access/allowed-ips-section.tsx` | **New client component** for the additional-IP form, so `remote-access-form.tsx` does not keep growing (see the 600-line rule in `do-task-post.md`). |
| `src/app/settings/remote-access/remote-access-form.tsx` | Render the new section, accept `additionalAllowedIps` as a prop, and reword the amber warning box. |
| `src/app/settings/remote-access/page.tsx` | Pass `settings.remoteAccess.additionalAllowedIps` down. |
| `.agent/PROJECT_DOCUMENT.md` | Documentation updates listed in the acceptance criteria. |

### Refusal behaviour

- HTTP: status `403`, header `Content-Type: text/plain; charset=utf-8`, body along the lines of
  `Forbidden: this address is not allowed to reach AgentHub.` Return immediately — do not call
  `handle`.
- Upgrade: `socket.destroy()` and return. Do not write an HTTP response body onto the raw socket.
- Log the first refusal per distinct remote address with `console.warn`, e.g.
  `Refused a connection from 192.168.1.42 (not in the allowed IP list).` Keep the seen addresses in
  a module-level `Set` so a port scanner cannot flood the log; clear the set once it holds more
  than 200 entries.

### Settings validation rules

For `remoteAccess.additionalAllowedIps` in `validateRemoteAccess`:

- Must be an array of strings; anything else → `SettingsValidationError`.
- Trim each entry, drop empty ones, and cap the list at 50 entries.
- Accept a bare IPv4/IPv6 address (stored as given, lowercased for IPv6) or `address/prefix`,
  where the prefix is an integer `0–32` for IPv4 and `0–128` for IPv6. Reject anything else with a
  message naming the bad entry, e.g. `"192.168.1.0/33" is not a valid IP address or CIDR range.`
- Reject duplicates after normalization.
- In `parseRemoteAccess` (reading `data/settings.json`) be strict like the neighbouring fields:
  a non-array or non-string entry throws `SettingsStoreError`; a missing key falls back to `[]`.

### UI notes

- One entry per line in a `<textarea>` is the simplest editable form; split on newlines, trim, drop
  blanks before sending. Follow the existing form/banner classes rather than inventing new styles.
- Show the built-in ranges as a read-only list with their labels and make clear they cannot be
  removed.
- Say plainly that adding a range widens who can drive the agents.

### Conventions to follow

- Read `node_modules/next/dist/docs/` before writing Next.js code; the installed Next.js (16.3.4)
  is newer than most training data (see `AGENTS.md` and `.agent/PROJECT_DOCUMENT.md`).
- Keep code readable and multi-line, per the **Code Readability** section of
  `.agent/PROJECT_DOCUMENT.md`.
- Server-only modules go under `server/`; client-safe catalogs stay in `src/lib/`.

### Pitfalls to avoid

- Do not put the guard in a Next.js `middleware.ts` — the WebSocket upgrade would bypass it.
- Do not place the upgrade guard after the `url.pathname !== "/api/agent-socket"` early return;
  the dev HMR upgrade must be guarded as well, and must keep working from localhost.
- Do not break the server's own `fetch` to `http://127.0.0.1:${port}` in
  `markExitedExecutionTaskExecuted` — loopback stays allowed, so this only needs verifying.
- `request.socket.remoteAddress` can be `undefined`; refuse in that case rather than allowing.
- Do not read `data/settings.json` on every request — the HTTP handler must decide synchronously
  from the cached `BlockList`.
- Do not add an "enabled" flag, an env-var escape hatch, or a bypass for `NODE_ENV=development`.
  The restriction is unconditional.
- Keep `src/lib/remote-access.ts` free of `node:` imports; it is imported by client components.

## Verification

- Run `pnpm build` and confirm it succeeds with no compilation or type errors.
- Run `pnpm lint` and fix every reported error.
- Start the app with `pnpm dev`, then from the same machine:
  - `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/` → `200`.
  - Find the machine's LAN address (`ipconfig getifaddr en0`) and run
    `curl -s -o /dev/null -w '%{http_code}\n' http://<lan-ip>:3000/` → `403`. The connection
    reports the LAN address as its source, so this reproduces a blocked remote client without a
    second device.
  - Confirm the server log shows the refusal warning once for that address.
- Add `<lan-ip>/32` (or the whole `192.168.x.0/24`) on `/settings/remote-access` from
  `http://127.0.0.1:3000`, save, then re-run the LAN `curl` **without restarting the server** →
  `200`. Remove it again → `403`.
- Check the WebSocket path: open `http://127.0.0.1:3000/console`, start a session and confirm
  output still streams. Then, with the LAN range removed, run

  ```bash
  curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    http://<lan-ip>:3000/api/agent-socket
  ```

  and confirm no `101 Switching Protocols` is returned and the connection is closed.
- Confirm `pnpm dev` HMR still works from localhost (edit a file and see the page update).
