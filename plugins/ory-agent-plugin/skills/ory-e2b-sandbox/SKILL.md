---
name: ory-e2b-sandbox
description: Scaffold an E2B (e2b.dev) sandbox template that boots with @ory/claude-code preinstalled, so every Claude/Codex/Gemini/OpenClaw/OpenCode session running inside the sandbox is gated by Ory auth, permissions, and tracing without any per-sandbox setup. Use when the user asks to "create an E2B sandbox with Ory agent security", "build an E2B template with the Ory plugin", "make an E2B image that includes Ory auth", or any close variant. The skill generates the template files in the user's project — it does not deploy them.
---

# E2B sandbox with Ory agent security

You are helping the user scaffold an [E2B](https://e2b.dev) sandbox template
that preinstalls and registers the @ory/claude-code plugin. The resulting template
publishes a named image; every `Sandbox.create("<tag>")` call from their SDK
gets a runtime where the agent's tool calls are already authenticated against
Ory Identities, authorized against Ory Permissions, and emitted as trace
spans — with **no** install step at sandbox boot.

This skill carries the full workflow and the file contents. You generate the
files in the user's repo; the user runs the build.

> **Precondition:** the user has (or will obtain) an `E2B_API_KEY` and has
> installed the E2B CLI / SDK (`npm install e2b dotenv`). If they haven't, point
> them at <https://e2b.dev/docs> and stop — do not fabricate credentials.

## Step 1 — Confirm the target

Before writing files, confirm with the user:

1. **Where in their repo should the integration live?** A common choice is
   `integrations/e2b/` at the repo root. Use that unless they say otherwise.
2. **Template tag.** Default to `agent-ory` (e.g. `claude-code-ory`,
   `codex-ory`). Operators will reference this string in `Sandbox.create()`.
3. **Will the sandbox have network access to Ory?** It must — the plugin makes
   live API calls to `ORY_PROJECT_URL` from inside the sandbox.

If the user is targeting an in-process harness (OpenClaw, OpenCode), the host
binary that loads the plugin must also be available inside the sandbox. Flag
this and ask how they ship that binary today — usually `npm install` of a
project that already depends on the harness runtime.

## Step 2 — Generate the files

Create these four files at the chosen location (the example uses
`integrations/e2b/`).

### `integrations/e2b/template.ts`

```ts
import { Template } from "e2b";

export const template = Template()
  .fromUbuntuImage("22.04")
  .aptInstall(["curl", "ca-certificates", "git", "python3"])

  // Node.js 20 (NodeSource)
  .runCmd("curl -fsSL https://deb.nodesource.com/setup_20.x | bash -")
  .aptInstall(["nodejs"])

  // Install the harness CLI globally. Replace `@anthropic-ai/claude-code` with
  // the binary that hosts the Ory plugin in this sandbox (e.g. the Codex or
  // Gemini CLI). For in-process harnesses (openclaw, opencode), `npm install`
  // the harness runtime here instead and ensure its entrypoint is on PATH.
  .npmInstall(["@anthropic-ai/claude-code"], { g: true })

  // Install the Ory plugin into the harness's discovery location.
  .setWorkdir("/root")
  .runCmd("npx -y -p @ory/claude-code ory-claude install")

  // Sandbox runtime defaults. Per-tenant secrets (project URL, tokens, client
  // IDs) MUST be passed at Sandbox.create() time, never baked into the image.
  .setEnvs({
    ORY_USER_LOGIN: "1",
    ORY_PERMISSION_MODE: "observe",
    ORY_PERMISSION_NAMESPACE: "AgentTools",
    ORY_AGENT_DEBUG: "true",
    ORY_AGENT_LOG_FILE: "/root/ory-agent-debug.log",
  })

  .setWorkdir("/workspace");
```

### `integrations/e2b/build.prod.ts`

```ts
import "dotenv/config";
import { Template, defaultBuildLogger } from "e2b";
import { template } from "./template";

await Template.build(template, "agent-ory", {
  cpuCount: 2,
  memoryMB: 4096,
  onBuildLogs: defaultBuildLogger(),
});
```

### `integrations/e2b/build.dev.ts`

```ts
import "dotenv/config";
import { Template, defaultBuildLogger } from "e2b";
import { template } from "./template";

await Template.build(template, "agent-ory-dev", {
  cpuCount: 2,
  memoryMB: 4096,
  skipCache: true,
  onBuildLogs: defaultBuildLogger(),
});
```

### `integrations/e2b/.env.example`

```
# E2B credentials — required to build and run templates.
E2B_API_KEY=e2b_***

# Per-tenant Ory wiring — passed to Sandbox.create() at runtime, NOT baked into
# the template. Listed here so operators know what to plumb through.
ORY_PROJECT_URL=https://<slug>.projects.oryapis.com
ORY_OAUTH2_CLIENT_ID=
ORY_USER_SESSION_TOKEN=
# Optional: pin a static agent identity instead of DCR.
# ORY_AGENT_API_KEY=
```

### `integrations/e2b/package.json`

```json
{
  "name": "ory-e2b-integration",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build:dev": "tsx build.dev.ts",
    "build:prod": "tsx build.prod.ts"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "e2b": "^2.3.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^6.0.2"
  }
}
```

### `integrations/e2b/README.md`

Generate a README that captures:

- What the template provides (harness CLI + @ory/claude-code preinstalled, runtime
  defaults baked in, secrets supplied at sandbox creation).
- The build flow: `npm install`, `npx e2b auth login` once, then
  `npm run build:prod`.
- A `Sandbox.create("agent-ory", { envs: { ... } })` example showing which env
  vars to inject at runtime (`ORY_PROJECT_URL`, `ORY_OAUTH2_CLIENT_ID`,
  `ORY_USER_SESSION_TOKEN` or `ORY_USER_OAUTH2_TOKEN`, optional
  `ORY_AGENT_API_KEY`).
- A pointer to `/project:ory-auth-setup` for full env-var coverage and to
  `/project:ory-local-dev` for testing the same plugin locally before publishing the
  template.

## Step 3 — Build and publish

Walk the user through:

```bash
cd integrations/e2b
cp .env.example .env        # then fill in E2B_API_KEY
npm install
npx e2b auth login          # one-time
npm run build:prod          # publishes the tag chosen in Step 1
```

Manage the published template via the E2B CLI:

```bash
npx e2b template list
npx e2b template delete <tag>
```

## Step 4 — Use the sandbox

Show the user the minimal SDK call once their template is live:

```ts
import { Sandbox } from "e2b";

const sbx = await Sandbox.create("agent-ory", {
  envs: {
    ORY_PROJECT_URL: process.env.ORY_PROJECT_URL!,
    ORY_OAUTH2_CLIENT_ID: process.env.ORY_OAUTH2_CLIENT_ID!,
    // Pre-supply a user token so the headless sandbox skips PKCE.
    ORY_USER_SESSION_TOKEN: process.env.ORY_USER_SESSION_TOKEN!,
  },
});

await sbx.commands.run("ory-claude --version");  // sanity check
```

Sandboxes are headless, so the user **must** pre-supply
`ORY_USER_SESSION_TOKEN` or `ORY_USER_OAUTH2_TOKEN` — otherwise user login's
PKCE browser flow has no target and hangs. See `/project:ory-auth-setup` for the full
env-var matrix.

## Step 5 — Promotion path

The template ships with `ORY_PERMISSION_MODE=observe` baked in so first-run
sandboxes never block. To promote a sandbox to hard enforcement without
rebuilding the template, either pass `ORY_PERMISSION_MODE=enforce` at
`Sandbox.create()` time, or run `npx -y -p @ory/claude-code ory-claude permissions enforce` inside a running
sandbox. Run `npx -y -p @ory/claude-code ory-claude permissions bootstrap` first on a fresh Ory project so
the `use` tuples exist before enforcement turns on.

## What this skill does NOT do

- It does not build or publish the template — the user runs the build, so
  they can see logs and own the resulting tag.
- It does not bake secrets into the image. `ORY_PROJECT_URL`, OAuth client IDs,
  and any tokens are always passed at `Sandbox.create()` time.
- It does not pin the harness CLI version inside the template. If the user
  wants reproducibility, swap the unpinned `npmInstall([...])` for a tagged
  version (e.g. `["@anthropic-ai/claude-code@1.2.3"]`) before building.
- It does not modify the user's Ory project. Use `/project:ory-auth-setup` to
  provision the OAuth2 client and namespaces the sandbox will need.
