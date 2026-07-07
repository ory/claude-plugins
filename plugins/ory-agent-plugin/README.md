# Ory Agent Plugin: Claude Code

[Ory](https://ory.com) bundled into [Claude Code](https://docs.anthropic.com/en/docs/claude-code): skills and slash commands that scaffold Ory authentication into your codebase, a local Ory stack you can spin up in one command, and (when pointed at an Ory project) authentication, authorization, and audit for every tool Claude runs.

You don't need an Ory account or any prior Ory experience to start.

## New to Ory?

[Ory](https://www.ory.com/docs/) is an open-source identity and access platform — it provides login, registration, sessions, social sign-in, multi-factor auth, and fine-grained permissions, so you don't have to build any of that yourself. Two things make it easy to try with no prior experience:

- **Ory Elements** are prebuilt, themeable UI components for the auth pages (login, registration, recovery, settings). The scaffolding skills wire them into your app for you.
- **The local Ory stack** is a complete Ory running on your laptop in Docker — no account, no signup, no API key. Everything in the Quickstart below works against it, fully offline.

This plugin does two independent things, and you can use either on its own:

1. **Build auth into your app.** Have Claude scaffold Ory login, registration, social sign-in, and permissions into the project you're working on, backed by the local stack. This is the Quickstart below — it needs nothing but Docker.
2. **Govern the agent itself.** Authenticate Claude's own session and authorize every tool it runs against Ory Permissions, with a full audit trail. See [Agent security](#agent-security).

If you're just exploring, do the Quickstart first.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and signed in
- Node.js **≥ 22**
- [Docker](https://docs.docker.com/get-docker/) (only needed for the local Ory stack)
- macOS or Linux. Windows works via WSL2.

## Install

Inside Claude Code:

```
/plugin marketplace add ory/claude-plugins
/plugin install ory-agent-plugin@ory
```

Then confirm everything landed:

```bash
npx -y -p @ory/claude-code ory-claude status
```

`status` is the single source of truth — it prints configuration, user and agent identity, per-tool permission coverage, hook + skill registration, and a tail of recent debug logs. Unconfigured fields show inline as `(unset)`.

<details>
<summary>Alternative install path (no Claude Code session required)</summary>

```bash
npx -y -p @ory/claude-code ory-claude install            # current project
npx -y -p @ory/claude-code ory-claude install --global   # all projects (user scope)
npx -y -p @ory/claude-code ory-claude uninstall
```

The installer requires the `claude` CLI on `PATH`.

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

4. **Turn on Ory login for the Claude session itself.** *(Optional but recommended.)* Out of the box the plugin only governs your *app*. To also attach an Ory identity to *Claude's* session — so every tool call is attributed to you, not a fallback `session:<id>` subject — opt in to the user-login flow:

   ```bash
   export ORY_USER_LOGIN=true
   export ORY_OAUTH2_CLIENT_ID=<value printed by `local up`>
   ```

   User login is off by default. Both exports above are printed in the `local up` banner — copy them straight from there. `ORY_OAUTH2_CLIENT_ID` is required whenever `ORY_USER_LOGIN` is on: it identifies the public OAuth2 client the PKCE browser flow exchanges for a token. With both set, the next Claude session opens an Ory login in your browser; sign in with the same seeded credentials from step 1, and the token is reused on subsequent sessions until it expires. This is what makes `permissions enforce` (see [Agent security](#agent-security)) deny on the right identity later.

That's the full Ory DX path. Stop here if you're just evaluating the plugin. Continue to [Agent security](#agent-security) when you're ready to enforce.

## What's included

### Skills for scaffolding Ory into your application

Each skill is a vetted, end-to-end playbook. Skills are model-invoked — ask Claude in natural language and the matching skill takes over. New to Ory? Start with the first group.

**Start here — add Ory auth to your app:**

- **`ory-auth-setup`** *(e.g. "set up Ory auth in this project")* — full project setup. Install the Ory CLI, create an Ory Network project (or use the local one), add Ory Elements, configure the SDK, build the auth pages, wire session middleware.
- **`ory-login-flow`** *(e.g. "add login and registration pages with Ory Elements")* — login, registration, recovery, verification, and settings pages with Ory Elements. Next.js App Router and React SPA variants.
- **`ory-social-login`** *(e.g. "add Google sign-in via Ory")* — Google, GitHub, Apple, Microsoft, Discord, and other OIDC providers with Jsonnet data mappers.
- **`ory-local-dev`** *(e.g. "run the local Ory stack")* — drive the local Ory stack from within Claude to prototype and test without a remote project.

**Going further:**

- **`ory-permissions-onboarding`** *(e.g. "grant me use on the Bash tool")* — walk through writing the Ory Permissions that let the plugin enforce per-tool access.
- **`ory-build-integration`** *(e.g. "wire an Ory webhook into my app")* — pull the runnable subset of an `ory/integrates` template (webhook / config / http-event) into the user's own app and wire it to their Ory project — no contribution/registry concerns.
- **`ory-contribute-integration`** *(e.g. "contribute a new Ory integration")* — author a brand-new integration as a contribution to `ory/integrates`, including `registry.entry.yaml`, the `Maintained by:` footer, DCO sign-off, and registry regeneration.
- **`ory-e2b-sandbox`** *(e.g. "create my e2b sandbox with ory agent security")* — scaffold an [E2B](https://e2b.dev) sandbox template that boots with this plugin preinstalled and registered, so every sandbox session is gated by Ory auth, permissions, and tracing without any per-sandbox setup.
- **`ory-build-agent`** *(e.g. "wire Ory into my own agent")* — drop `@ory/argus` directly into a custom agent you own (Claude Agent SDK, OpenAI Agents SDK, Mastra, Vercel AI SDK, PydanticAI, LangGraph, Mistral AI, or Salesforce Agentforce) so the user is authenticated, every tool call is authorized against Ory Permissions, and the lifecycle emits trace spans.
- **`ory-temporal-worker`** *(e.g. "wire Ory into my Temporal worker")* — scaffold a [Temporal](https://temporal.io) TypeScript worker per the [official local-dev guide](https://docs.temporal.io/develop/typescript/set-up-your-local-typescript), with every Activity gated by an Ory permission check, the worker's agent identity resolved via DCR, and the full lifecycle emitting trace spans.

### Ory MCP server

Bundled and registered automatically. Exposes the Ory CLI and the Ory Network REST API as MCP tools so Claude can manage identities, OAuth2 clients, projects, permissions, and configuration without ever leaving the chat. Useful for seeding test data, verifying a scaffolded integration, or running one-off admin tasks.

### Local Ory stack

```
/ory-agent-plugin:local-up      # start a local Ory instance in Docker
/ory-agent-plugin:local-down    # tear it all down
/ory-agent-plugin:temporal-up   # start a local Temporal dev server (for ory-temporal-worker)
```

`local-up` runs a complete Ory on your laptop: the Ory APIs (Identities, OAuth2, Permissions) at `http://localhost:4000`, a login UI on `:4455` (not :3000, to avoid Next.js port conflicts), and Jaeger (the trace viewer) on `:16686`. A test user identity is seeded and its credentials are printed for you. Use it to:

- **Learn Ory hands-on** without signing up for a hosted project.
- **Prototype** flows (login, social, MFA, recovery, permissions) against a real Ory backend.
- **Test** an auth integration end-to-end before pushing anything to a real environment.
- **Develop** your application against the same identity, OAuth2, and permission surfaces you'll ship with.

## Pointing at a real Ory project

The Quickstart uses the local stack. If you have a hosted [Ory Network](https://console.ory.sh) project (Ory's managed cloud), point the plugin at it with a single configure command. **The plugin requires `--oauth2-client-id` whenever `--project-url` is provided** — register the client first (see [Register the user OAuth2 client](#register-the-user-oauth2-client) below), then run:

```bash
npx -y -p @ory/claude-code ory-claude configure \
  --project-url https://<id>.projects.oryapis.com \
  --oauth2-client-id <public OAuth2 client id>
```

- **`--project-url`** points the plugin at your project. The **agent identity** (machine credentials for Claude's outgoing Ory API calls) is created automatically on first run via OAuth2 Dynamic Client Registration ([RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591)) against the project's `/oauth2/register` endpoint — no manual step required for that one.
- **`--oauth2-client-id`** is required because the **user** PKCE browser flow (triggered by `ORY_USER_LOGIN=true`) cannot self-register — you must register a public OAuth2 client ahead of time and supply its id here. The configure command refuses to save a project URL without it, so you don't end up with a silently-broken setup later. See [Register the user OAuth2 client](#register-the-user-oauth2-client) below for the exact CLI / Console steps.
- **`--api-key ory_pat_...`** is optional — pass it only if you want to override the auto-registered agent identity with a static personal access token (operator override; rarely needed).

If you only want audit logging (no auth or permission checks), substitute `--audit-only` — the OAuth2 client id is not required in that mode:

```bash
npx -y -p @ory/claude-code ory-claude configure --audit-only
```

The same settings can be supplied via environment variables (`ORY_PROJECT_URL`, `ORY_OAUTH2_CLIENT_ID`, `ORY_AGENT_API_KEY`) — env vars take precedence over the config file when both are set, which is what most CI / scripted setups want.

Config is saved to `~/.config/ory-agent-plugins/config.json` and shared across every Ory agent plugin on the machine.

Without any configuration the plugin still loads cleanly and runs in **pass-through mode**: skills, slash commands, and audit logging work, but no permission checks run, so nothing is ever blocked. You can stay in pass-through mode indefinitely if you only want the DX features.

### Register the user OAuth2 client

If you plan to turn on `ORY_USER_LOGIN=true` (recommended — it's what attributes every tool call to *you* rather than a fallback `session:<id>` subject), your hosted Ory project needs a **public** OAuth2 client (no client secret) registered ahead of time. The local stack provisions this for you automatically; against a hosted project you have to register it once yourself.

The client must list **all four** loopback ports as redirect URIs:

- `http://127.0.0.1:47823/callback`
- `http://127.0.0.1:47824/callback`
- `http://127.0.0.1:47825/callback`
- `http://127.0.0.1:47826/callback`

The plugin walks the four ports at runtime so the login can survive any one of them being occupied — Ory rejects the callback if the port it lands on isn't on the registered list, so register all four.

Create the client with the [Ory CLI](https://www.ory.com/docs/guides/cli/installation):

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

…or in the [Ory Console](https://console.ory.sh) under *OAuth2* → *Clients* → *Create client* (pick "Public client", set "Authorization Code" + "Refresh Token" grants, scopes `openid offline_access`, paste the four redirect URIs above). Then persist the issued id with the configure command (preferred — survives across sessions):

```bash
npx -y -p @ory/claude-code ory-claude configure \
  --project-url https://<id>.projects.oryapis.com \
  --oauth2-client-id <client-id from the step above>
```

…or set it in the environment alongside `ORY_USER_LOGIN`:

```bash
export ORY_USER_LOGIN=true
export ORY_OAUTH2_CLIENT_ID=<client-id from the step above>
```

Headless / CI runs that already hold a session token can skip this entirely by setting `ORY_USER_SESSION_TOKEN` instead — no browser flow runs, so no OAuth2 client is needed.

## Agent security

Once the plugin is pointed at an Ory project (local or hosted), Claude's session and every tool call can be governed by Ory.

- **Authentication.** Two identities. The human at the keyboard (the **user**) authenticates interactively via Ory Identities when user login is enabled (`ORY_USER_LOGIN=true`, off by default — browser PKCE flow on first session, persisted token thereafter). The Claude process (the **agent**) gets its own OAuth2 identity, self-registered via [Dynamic Client Registration (RFC 7591)](https://datatracker.ietf.org/doc/html/rfc7591) on first run. Sub-agents launched by the `Task` tool each receive their own typed identity.
- **Authorization.** Before any tool runs, the plugin checks [Ory Permissions](https://www.ory.com/docs/keto) (Zanzibar-style relations) against the user's subject and blocks the call on `deny`. MCP tool calls additionally get a server-level check.
- **Audit.** Every decision (allow, deny, fallback) is recorded as a structured trace span: NDJSON file output and/or OTLP/HTTP export to Jaeger, Honeycomb, Grafana, and similar collectors. The user → agent (and agent → subagent) delegation chain is written to Ory as relations so *"agent X acting on behalf of user Y"* stays queryable after tokens expire.

The plugin is **fail-open** on its own infrastructure failures (network errors, rate limits, missing config), so enforcement is only as strong as your permission grants — grant explicit `use` on the tools each user should be able to run.

### Enable enforcement

With an Ory project configured, the plugin runs in **observe mode** by default: every tool call is checked against Ory Permissions, a deny is recorded as a `permission.observe_deny` audit span, and the tool runs anyway. This lets you see what *would* be blocked before turning on hard blocking. (Without a project configured, the plugin is in pass-through mode — no checks run at all.)

1. **Turn on user login.** It's off by default. In your shell:

   ```bash
   export ORY_USER_LOGIN=true
   export ORY_OAUTH2_CLIENT_ID=<public OAuth2 client id>
   ```

   The next Claude session opens a browser for PKCE login. Subsequent sessions reuse the persisted token until it expires.

   `ORY_OAUTH2_CLIENT_ID` is required when `ORY_USER_LOGIN` is on: PKCE needs a public OAuth2 client registered with the four loopback redirect URIs (`http://127.0.0.1:47823..47826/callback`) to exchange the authorization code for a token. The local stack provisions one and prints the export in its `local up` banner; for a hosted Ory project see [Register the user OAuth2 client](#register-the-user-oauth2-client) for the exact CLI / Console steps. Headless / CI runs can skip the browser flow entirely by pre-supplying `ORY_USER_SESSION_TOKEN` instead.

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
npx -y -p @ory/claude-code ory-claude configure                         [--project-url <url> --oauth2-client-id <id>] [--api-key <key>] [--audit-only]
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

- **`/ory-agent-plugin:local-up` fails.** Make sure Docker is running and ports `4455` (login UI), `4000`, `4100`, and `16686` are free.
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
