# Ory Agent Plugin: Claude Code

Security and developer experience for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), powered by [Ory](https://ory.com).

**Security.** Claude runs real actions on your machine — editing files, running shell commands, calling APIs. The plugin gives every session a verifiable identity (you sign in once; Claude and any sub-agents it spawns each get their own), checks every tool call against permissions you control, and records each decision as an audit trace you can ship to your observability stack. It starts in watch mode so nothing is blocked on day one, and if Ory is ever unreachable it steps aside rather than locking you out.

**Developer experience.** A single command installs the plugin and walks you through connecting — choose Ory Network, a local Docker stack, or audit-only, and it wires up the project, sign-in client, login, and permissions for you. It also helps you build Ory into your own app: ask in plain language to scaffold login, registration, and recovery pages, run a local Ory, or manage identities and permissions through the bundled MCP server.

## What you'll need

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code), installed and signed in
- Node.js **22 or newer**
- [Docker](https://docs.docker.com/get-docker/) — only if you want to run Ory locally
- macOS or Linux (Windows works via WSL2)

## Get started

Run one command. It installs the plugin and walks you through connecting:

```bash
npx -y -p @ory/claude-code ory-claude install
```

You'll be asked how you want to connect — **press Enter for the default**:

- **Ory Network** *(default)* — sign in, or create a free account, in your browser. The project, keys, permissions, and login are all set up for you. Nothing to configure by hand.
- **Local** — run a complete Ory on your laptop with Docker. No account, no signup, no keys. Great for trying it out.
- **Audit-only** — skip Ory entirely and just log what Claude does.

That's it. Confirm everything landed with:

```bash
npx -y -p @ory/claude-code ory-claude status
```

`status` is your one-stop check: what's configured, who's signed in, which tools are covered by permissions, and recent activity. Anything not set up yet shows as `(unset)`.

> Prefer to install from inside Claude Code? Run `/plugin marketplace add ory/claude-plugins` then `/plugin install ory-agent-plugin@ory`. That registers the plugin but skips the guided setup — run `ory-claude install` (or `configure`) in a terminal afterwards to connect. Re-run install with `--reconfigure` to change your connection later, or `--no-configure` to skip the wizard.

## What you get

Once connected, every tool Claude runs is governed by Ory — three things happen automatically:

- **Who's driving.** You sign in once in your browser; Claude (and any sub-agents it spawns) each get their own identity. No tokens to copy around, and the "who acted on whose behalf" trail stays queryable later.
- **What it's allowed to do.** Before a tool runs, Ory checks whether it's permitted. It starts in **watch mode** — nothing is blocked, you just *see* what would be — so it never gets in your way on day one.
- **A record of everything.** Every decision (allowed, denied, skipped) is logged as a trace you can send to Jaeger, Honeycomb, Grafana, or just a file.

If Ory is ever unreachable, the plugin gets out of the way and lets Claude keep working — so it can't lock you out.

### See what's happening

Everything the plugin does is observable out of the box — no configuration required:

- **Status at a glance.** `npx -y -p @ory/claude-code ory-claude status` shows what's configured, who's signed in, how many built-in tools your permissions cover, and the most recent tool-call activity.
- **Live traces.** Every tool call is recorded as an OpenTelemetry-style span. Watch them stream as the agent works:

  ```bash
  npx -y -p @ory/claude-code ory-claude watch
  ```

  Spans are also written to `~/.config/ory-agent-plugins/claude-code/ory-agent-trace.ndjson` (NDJSON, one span per line) — tail that file, or point `OTEL_EXPORTER_OTLP_ENDPOINT` at a collector to ship them straight to Jaeger, Honeycomb, or Grafana.
- **Debug log.** For a verbose play-by-play, set `ORY_AGENT_DEBUG=true`; structured logs land in `~/.config/ory-agent-plugins/claude-code/ory-agent-debug.log`.

### Ready to enforce?

When the watch-mode logs look right, turn on blocking with one command (setup already granted you the built-in tools):

```bash
npx -y -p @ory/claude-code ory-claude permissions enforce
```

Now a denied tool is actually blocked and Claude shows why. Go back to watch mode anytime with `permissions observe`. Use `permissions status` to see what's covered and `permissions bootstrap` to (re-)grant the built-in tools — or just ask Claude in chat, e.g. *"grant me use of the Bash tool."*

## Also: add login to your own app

Beyond securing Claude, the plugin helps you build Ory into whatever you're working on. Ask Claude *"add Ory login to this app"* and it scaffolds the login, registration, recovery, and settings pages (using [Ory Elements](https://github.com/ory/elements)) wired to a local Ory — no signup or keys needed. Start that local Ory with `/ory-agent-plugin:local-up` (it prints a test email + password to sign in with) and tear it down with `/ory-agent-plugin:local-down`.

Bundled **skills** (just ask in plain language) cover more: `ory-auth-setup`, `ory-login-flow`, `ory-social-login` (Google, GitHub, Apple…), `ory-permissions-onboarding`, and playbooks for wiring Ory into your own agents, E2B sandboxes, or Temporal workers. A built-in **Ory MCP server** lets Claude manage identities, projects, and permissions straight from chat.

## Configure by hand (CI / advanced)

The guided setup covers most people. For scripted or CI setups, or to point at an existing Ory Network project, configure directly. Settings are saved to `~/.config/ory-agent-plugins/config.json` and shared across all your Ory agent plugins; environment variables win when both are set.

```bash
npx -y -p @ory/claude-code ory-claude configure \
  --project-url https://<slug>.projects.oryapis.com \
  --oauth2-client-id <login client id> \
  --user-login
```

Claude's own identity registers itself automatically on first run — nothing to create. The `--oauth2-client-id` is the one piece browser sign-in needs; the guided setup makes it for you, or see below to do it by hand. For logging-only with no checks, use `--audit-only`.

<details>
<summary>Create the sign-in client by hand</summary>

The guided setup normally does this. To do it yourself, create a **public** OAuth2 client (no secret) listing all four loopback URLs — the plugin tries each in turn so sign-in survives a busy port:

```bash
ory create oauth2-client --project <project-id> \
  --name "ory-agent-plugin" \
  --grant-type authorization_code,refresh_token \
  --response-type code \
  --scope openid,offline_access \
  --token-endpoint-auth-method none \
  --redirect-uri http://127.0.0.1:47823/callback \
  --redirect-uri http://127.0.0.1:47824/callback \
  --redirect-uri http://127.0.0.1:47825/callback \
  --redirect-uri http://127.0.0.1:47826/callback
```

Pass the resulting id to `configure --oauth2-client-id`. Running headless with a session token already? Set `ORY_USER_SESSION_TOKEN` and skip the browser step entirely.

</details>

With nothing configured, the plugin still loads and runs in **pass-through mode**: skills, commands, and logging work, but no checks run and nothing is blocked. Perfectly fine if you only want the app-building features.

## Commands

```
ory-claude install | uninstall        Install/remove; --reconfigure re-runs setup, --no-configure skips it
ory-claude status                     Show configuration, identities, permission coverage, recent activity
ory-claude watch                      Tail the live trace stream (OTel spans)
ory-claude permissions <cmd>          status | bootstrap | observe (watch) | enforce (block)
ory-claude configure <flags>          Point at a project by hand (--project-url, --oauth2-client-id, --user-login, --audit-only)
ory-claude agent <status|unregister>  Manage Claude's own auto-created identity
ory-claude local <up|down|status|…>   Run / manage a local Ory in Docker
```

All prefixed with `npx -y -p @ory/claude-code`.

## Troubleshooting

- **`local-up` fails** — make sure Docker is running and ports `4000`, `4100`, `4455`, and `16686` are free.
- **Browser sign-in loops** — reset with `ory-claude agent unregister` and try again.
- **Install ran but never asked how to connect** — you're almost certainly on a stale `npx` cache. `npx -p @ory/claude-code` (no version pin) reuses a previously-downloaded copy instead of re-resolving to the latest, so an older CLI — one whose install predates the setup wizard — can run while `claude plugin` still installs current plugin content. The install banner prints the running version; confirm it with `npx -y -p @ory/claude-code ory-claude version`. To force the current release, clear the cache and reinstall: `rm -rf ~/.npm/_npx` then `npx -y -p @ory/claude-code ory-claude install`. Pinning an exact version (`@ory/claude-code@<version>`) also bypasses the cached copy.
- **Hooks stuck on an old version** — run `/plugin marketplace update ory` inside Claude Code, or re-run the installer.
- **Want to see what's happening** — `npx -y -p @ory/claude-code ory-claude status` for a snapshot, `npx -y -p @ory/claude-code ory-claude watch` for the live trace stream, or set `ORY_AGENT_DEBUG=true` for a verbose log. Traces and logs live under `~/.config/ory-agent-plugins/claude-code/` (see [See what's happening](#see-whats-happening)).

## Learn more

- [Ory documentation](https://www.ory.com/docs/) · [Ory Console](https://console.ory.sh) · [Ory Elements](https://github.com/ory/elements)
- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code)

## License

Apache-2.0
