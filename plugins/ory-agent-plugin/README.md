# Ory Agent Plugin: Claude Code

[Ory](https://ory.com) bundled into [Claude Code](https://docs.anthropic.com/en/docs/claude-code): skills and slash commands that scaffold Ory authentication into your codebase, a local Ory stack you can spin up in one command, and (when pointed at an Ory project) authentication, authorization, and audit for every tool Claude runs.

You don't need an Ory account or any prior Ory experience to start.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and signed in
- Node.js **≥ 24**
- [Docker](https://docs.docker.com/get-docker/) (only needed for the local Ory stack)
- macOS or Linux. Windows works via WSL2.

## Install

Inside Claude Code:

```
/plugin marketplace add ory/claude-plugins
/plugin install ory-agent-plugin@ory
```

Skills, slash commands, hooks, and the Ory MCP server are now registered. Verify with `/plugin list`.

<details>
<summary>Alternative install path (no Claude Code session required)</summary>

```bash
# Direct installer — registers the marketplace and installs the plugin via the claude CLI.
npx -y -p @ory/claude-code ory-claude install            # current project
npx -y -p @ory/claude-code ory-claude install --global   # all projects (user scope)
npx -y -p @ory/claude-code ory-claude uninstall
```

The installer requires the `claude` CLI on `PATH`. After it finishes, run `ory-claude status` to confirm the plugin is registered.

</details>

## Quickstart

From any project where you'd like Ory authentication, inside Claude Code:

1. **Start a local Ory instance.** *(~1 min. Requires Docker running.)* Ask Claude *"start the local Ory stack"* or run the slash command:

   ```
   /ory-agent-plugin:local-up
   ```

   A banner prints the seeded test user's email and password. Note them — you'll log in with them in step 3.

2. **Scaffold Ory into your project.** *(~5–10 min, depending on your project.)* Ask Claude *"add Ory auth to this app"*. The `ory-auth-setup` skill takes over: it installs Ory Elements, wires the SDK, generates the login / registration / recovery / verification / settings pages, and sets up session middleware. It targets the local stack from step 1, so no signup or API key is needed.

3. **Sign in.** Start your app, visit the login page Claude added, and sign in with the seeded credentials. You now have a real Ory session backed by a real Ory stack — locally, offline, with zero configuration.

4. **Turn on Ory login for the Claude session itself.** *(Optional but recommended.)* Out of the box the plugin only governs your *app*. To also attach an Ory identity to *Claude's* session — so every tool call is attributed to you, not a fallback `session:<id>` subject — set:

   ```bash
   export ORY_AUTH_GATE=1
   ```

   Then restart Claude. On next session start, Claude opens an Ory login in your browser; sign in with the same seeded credentials from step 1. This is what makes `permissions enforce` (see [Agent security](#agent-security)) deny on the right identity later.

That's the full Ory DX path. Stop here if you're just evaluating the plugin. Continue to [Agent security](#agent-security) when you're ready to enforce.

## What's included

### Skills for scaffolding Ory into your application

Each skill is a vetted, end-to-end playbook. Skills are model-invoked — ask Claude in natural language and the matching skill takes over.

- **`ory-auth-setup`** *(e.g. "set up Ory auth in this project")* — full project setup. Install the Ory CLI, create an Ory Network project (or use the local one), add Ory Elements, configure the SDK, build the auth pages, wire session middleware.
- **`ory-login-flow`** *(e.g. "add login and registration pages with Ory Elements")* — login, registration, recovery, verification, and settings pages with Ory Elements. Next.js App Router and React SPA variants.
- **`ory-social-login`** *(e.g. "add Google sign-in via Ory")* — Google, GitHub, Apple, Microsoft, Discord, and other OIDC providers with Jsonnet data mappers.
- **`ory-local-dev`** *(e.g. "run the local Ory stack")* — drive the local Ory stack from within Claude to prototype and test without a remote project.
- **`ory-permissions-onboarding`** *(e.g. "grant me use on the Bash tool")* — walk through writing the Ory Permissions that let the plugin enforce per-tool access.

### Ory MCP server

Bundled and registered automatically. Exposes the Ory CLI and the Ory Network REST API as MCP tools so Claude can manage identities, OAuth2 clients, projects, permissions, and configuration without ever leaving the chat. Useful for seeding test data, verifying a scaffolded integration, or running one-off admin tasks.

### Local Ory stack

```
/ory-agent-plugin:local-up      # start a local Ory instance in Docker
/ory-agent-plugin:local-down    # tear it all down
```

`local-up` brings up Ory Identities, OAuth2, and Permissions, plus a login UI on `:3000` and Jaeger on `:16686`, all reachable through `http://localhost:4000`. A test user identity is seeded and the credentials are printed for you. Use it to:

- **Learn Ory hands-on** without signing up for a hosted project.
- **Prototype** flows (login, social, MFA, recovery, permissions) against a real Ory backend.
- **Test** an auth integration end-to-end before pushing anything to a real environment.
- **Develop** your application against the same identity, OAuth2, and permission surfaces you'll ship with.

## Pointing at a real Ory project

The Quickstart uses the local stack. If you have a hosted [Ory Network](https://console.ory.sh) project, point the plugin at it. A project URL is enough — the agent identity is created automatically via OAuth2 Dynamic Client Registration on first run:

```bash
npx -y -p @ory/claude-code ory-claude configure \
  --project-url https://<id>.projects.oryapis.com
```

Pass `--api-key ory_pat_...` only if you want to override the auto-registered agent identity with a static personal access token (operator override; rarely needed).

Config is saved to `~/.config/ory-agent-plugins/config.json` and shared across every Ory agent plugin on the machine. The same settings can be supplied via environment variables (`ORY_PROJECT_URL`, `ORY_AGENT_API_KEY`) — env vars take precedence over the config file when both are set, which is what most CI / scripted setups want.

Without any configuration the plugin still loads cleanly and runs in **pass-through mode**: skills, slash commands, and audit logging work, but no permission checks run, so nothing is ever blocked. You can stay in pass-through mode indefinitely if you only want the DX features.

## Agent security

Once the plugin is pointed at an Ory project (local or hosted), Claude's session and every tool call can be governed by Ory.

- **Authentication.** Two identities. The human at the keyboard (the **user**) authenticates interactively via Ory Identities when `ORY_AUTH_GATE=1` is set. The Claude process (the **agent**) gets its own OAuth2 identity, self-registered via [Dynamic Client Registration (RFC 7591)](https://datatracker.ietf.org/doc/html/rfc7591) on first run. Sub-agents launched by the `Task` tool each receive their own typed identity.
- **Authorization.** Before any tool runs, the plugin checks [Ory Permissions](https://www.ory.sh/docs/keto) (Zanzibar-style relations) against the user's subject and blocks the call on `deny`. MCP tool calls additionally get a server-level check.
- **Audit.** Every decision (allow, deny, fallback) is recorded as a structured trace span: NDJSON file output and/or OTLP/HTTP export to Jaeger, Honeycomb, Grafana, and similar collectors. The user → agent (and agent → subagent) delegation chain is written to Ory as relations so *"agent X acting on behalf of user Y"* stays queryable after tokens expire.

The plugin is **fail-open** on its own infrastructure failures (network errors, rate limits, missing config), so enforcement is only as strong as your permission grants — grant explicit `use` on the tools each user should be able to run.

### Enable enforcement

With an Ory project configured, the plugin runs in **observe mode** by default: every tool call is checked against Ory Permissions, a deny is recorded as a `permission.observe_deny` audit span, and the tool runs anyway. This lets you see what *would* be blocked before turning on hard blocking. (Without a project configured, the plugin is in pass-through mode — no checks run at all.)

1. **Turn on the user gate.** In your shell:

   ```bash
   export ORY_AUTH_GATE=1
   ```

   The next Claude session opens a browser for PKCE login. Subsequent sessions reuse the persisted token until it expires.

2. **Bootstrap permissions for the built-in tools.** One idempotent command grants the current user `use` on every tool Claude ships with (Read, Write, Bash, …):

   ```bash
   npx -y -p @ory/claude-code ory-claude permissions bootstrap
   ```

   If a user identity is already cached at install time, the installer runs this for you automatically — re-run after adding tools, switching subjects, or changing the namespace.

3. **Check coverage.** `permissions status` probes every tool in the harness's catalog and prints allowed / denied per tool:

   ```bash
   npx -y -p @ory/claude-code ory-claude permissions status
   ```

   Add permissions for any MCP server tools or custom commands by hand, or via the Ory MCP server from inside Claude (*"grant me use on the Bash tool"*).

4. **Promote to enforce.** Once the observe-mode logs look right, switch over:

   ```bash
   npx -y -p @ory/claude-code ory-claude permissions enforce
   ```

   Denies now block the tool call; Claude shows the denial reason and the decision is recorded as a `tool.block` trace span with `blocked: true`. Switch back any time with `permissions observe`.

## CLI reference

```
npx -y -p @ory/claude-code ory-claude install | uninstall              [--global]
npx -y -p @ory/claude-code ory-claude configure                         [--project-url <url>] [--api-key <key>] [--audit-only]
npx -y -p @ory/claude-code ory-claude agent <status|unregister>         Manage the agent's OAuth2 identity
npx -y -p @ory/claude-code ory-claude permissions <status|bootstrap|observe|enforce>
npx -y -p @ory/claude-code ory-claude local <up|down|status|seed|logs|env|configure|reset>
npx -y -p @ory/claude-code ory-claude status
```

Highlights:

- `agent status` — show the current persisted DCR identity for the agent.
- `permissions observe` / `permissions enforce` — switch between "log denies, allow through" (the install default) and "block denies." `permissions bootstrap` writes `use` permissions for the harness's built-in tools so the promotion path doesn't require hand-writing relations.
- `configure --audit-only` — kill switch that disables Ory entirely (no auth, no permission checks; only audit logging of tool invocations). For phased rollouts, prefer `permissions observe` over `--audit-only`.
- `local seed` / `local env` — reseed the test user, or print env vars for pointing other tools at the local stack.

## Troubleshooting

- **`/ory-agent-plugin:local-up` fails.** Make sure Docker is running and ports `3000`, `4000`, `4100`, and `16686` are free.
- **PKCE login loops.** Clear persisted state with `npx -y -p @ory/claude-code ory-claude agent unregister` and retry.
- **`npx` fetches an old version.** Force a fresh fetch: `npx -y -p @ory/claude-code@latest ory-claude …`.
- **Hooks pinned to an old plugin version.** After a plugin upgrade, run `/plugin marketplace update ory` inside Claude Code (or re-run the npx installer) so the hook commands and MCP server pick up the new release.
- **Need more signal.** Set `ORY_AGENT_DEBUG=true` and `ORY_AGENT_LOG_FILE=/tmp/ory.log` to capture structured logs.

## Links

- [Ory documentation](https://www.ory.com/docs/)
- [Ory Network console](https://console.ory.sh)
- [Ory Elements](https://github.com/ory/elements)
- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code)

## License

Apache-2.0
