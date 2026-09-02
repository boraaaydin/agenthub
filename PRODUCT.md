# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers working locally who use terminal-based AI coding agents and need to keep several projects ready for agent work.

## Product Purpose

AgentHub is a locally run browser control panel for starting and continuing terminal-based coding-agent sessions while viewing their live terminal output. It makes local project management and agent-session access easier without deploying a public service.

## Positioning

AgentHub keeps interactive coding-agent CLIs attached to pseudo-terminals and streams their raw terminal output to the browser, preserving the live, persistent terminal-session experience.

## Operating Context

Users work on their own machines, save local working-directory paths as projects, select coding agents, send prompts, and switch between concurrent sessions. Project metadata persists locally; active sessions are in-memory only.

## Capabilities and Constraints

- Supports persistent, concurrent local sessions for terminal-based coding agents.
- Uses Next.js, WebSockets, node-pty, and xterm.js.
- Project records contain a name, local directory path, ID, and creation timestamp; they can be created, edited, and deleted.
- Localhost-only operation; no authentication is currently implemented.
- A project path must resolve to an existing directory. Project records do not configure or start agent sessions.

## Brand Commitments

AgentHub uses clear, calm language for a practical developer tool.

## Evidence on Hand

The repository contains the working Next.js application and its local project data implementation. No external brand assets, testimonials, or public claims are supplied.

## Product Principles

- Preserve the immediacy of a real terminal session.
- Keep local project management straightforward and reversible.
- Make session state and controls easy to scan.
- Keep scope focused on local developer workflows.
