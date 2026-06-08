---
name: ory-local-dev
description: Run a local Ory stack (Kratos identity, Keto permissions, Hydra OAuth2, gateway on :4000) for building and testing an authentication application without an Ory Network project. Use whenever the user wants to develop, prototype, or test login/registration/recovery/permission flows locally — phrases like "run Ory locally", "no Ory project yet", "offline auth dev", "test my login flow", "spin up Kratos/Keto/Hydra", or "I just want to try this on my machine". Drives the `/ory-agent-plugin:local-up` and `/ory-agent-plugin:local-down` commands.
---

# Build an Auth App Against a Local Ory Stack

You are helping the user develop an authentication application against a
**local Ory stack** running in Docker — not against Ory Network. The
`@ory/claude-code` plugin ships two commands that
manage the lifecycle:

- `/ory-agent-plugin:local-up` — start Kratos, Keto, Hydra, and an Nginx gateway,
  then seed a test identity, session, and permission tuples.
- `/ory-agent-plugin:local-down` — stop all services while preserving data volumes.

Both delegate to `npx -y -p @ory/claude-code ory-claude local <subcommand>`, so the same
workflow runs from the shell when the command shortcuts are not available.

## When to use this skill

Pick the local stack over Ory Network when any of these are true:

- The user has no Ory Network project yet and wants to prototype.
- The user is working offline or behind an egress restriction.
- The user wants deterministic, throwaway test data they can reset
  freely (`local reset`).
- The user is writing automated tests that hit a real Ory backend.

If the user already has an Ory Network project and just wants their
production app wired up, prefer the `/project:ory-auth-setup` skill and
point the SDK at the Network URL instead.

## What `/ory-agent-plugin:local-up` gives you

After `/ory-agent-plugin:local-up` completes:

| Service       | URL                              | Purpose                              |
|---------------|----------------------------------|--------------------------------------|
| Gateway       | `http://localhost:4000`          | Unified API (mirrors Ory Network)    |
| Kratos public | `http://localhost:4433`          | Self-service flows (login, etc.)     |
| Kratos admin  | `http://localhost:4434`          | Identity & session admin             |
| Keto read     | `http://localhost:4466`          | Permission checks                    |
| Keto write    | `http://localhost:4467`          | Relation tuple writes                |
| Hydra public  | `http://localhost:4444`          | OAuth2 / OIDC                        |
| Hydra admin   | `http://localhost:4445`          | OAuth2 client management             |

The seed step also produces:

- Test identity: `agent@ory-local.dev`
- A live session token (printed at the end of `/ory-agent-plugin:local-up`)
- Permission tuples in the `AgentTools` namespace for common tool names
- An OAuth2 client (`ory-agent-plugins-local`, `client_credentials` grant)

## Step 1: Verify Docker is running

The local stack is Docker Compose under the hood. Before invoking
`/ory-agent-plugin:local-up`, confirm Docker is available:

```bash
docker info
```

If Docker is not running, ask the user to start Docker Desktop (or their
docker engine) and retry. Do not try to install Docker for them.

## Step 2: Start the stack

Tell the user to run `/ory-agent-plugin:local-up`, or the equivalent shell command:

```bash
npx -y -p @ory/claude-code ory-claude local up
```

Wait for the command to print "All services are running!" and the seed
output. Capture two values from the output:

- `ORY_PROJECT_URL` (always `http://localhost:4000`)
- `ORY_SESSION_TOKEN` (the seeded session token)

If the user wants to skip seeding (to bring their own data), use
`npx -y -p @ory/claude-code ory-claude local up --no-seed` instead.

## Step 3: Point the app at the local gateway

The local gateway is a drop-in replacement for the Ory Network SDK URL.
Configure the auth app exactly as you would for Ory Network, but point
at the gateway:

**Environment variables (`.env.local` or shell):**

```bash
NEXT_PUBLIC_ORY_SDK_URL=http://localhost:4000
ORY_SDK_URL=http://localhost:4000
```

For Next.js, that is the only change needed in
`/project:ory-auth-setup`'s SDK configuration. For React SPAs, use the
same value as `basePath` in the Ory `Configuration`.

**Persist it across plugin sessions** (so all Ory agent plugins on this
machine target the local stack):

```bash
npx -y -p @ory/claude-code ory-claude local configure
```

This writes the URL to the shared plugin config so future agent runs
do not need the env var.

## Step 4: Build the auth UI

Use the existing skills for the UI layer — they apply unchanged when
the SDK points at the local gateway:

- `/project:ory-auth-setup` — full Ory Elements bootstrap (this is the
  default UI path, including against the local stack).
- `/project:ory-login-flow` — login, registration, recovery,
  verification, settings pages.

**Skip the Ory Tunnel step** when developing against the local stack.
The tunnel only exists to bridge cookies between localhost and Ory
Network. The local gateway already runs on localhost, so cookies work
directly.

## Step 5: Test with the seeded identity

Two ways to exercise the flows:

1. **Browser flow (registration UI)** — register a brand new identity
   through the Elements `<Registration>` page. This validates the
   self-service flow end-to-end.
2. **Seeded identity (admin-created)** — log in as `agent@ory-local.dev`
   with password `ory-agent-local-dev-password!` to test session-bearing
   pages without going through registration.

For automated tests against the running stack, use the seeded session
token directly:

```bash
curl -H "X-Session-Token: $ORY_SESSION_TOKEN" \
     http://localhost:4000/sessions/whoami
```

## Step 6: Iterate

Common day-to-day commands:

| Need                           | Command                                  |
|--------------------------------|------------------------------------------|
| Re-seed (after `local reset`)  | `npx -y -p @ory/claude-code ory-claude local seed`              |
| Tail Kratos logs               | `npx -y -p @ory/claude-code ory-claude local logs kratos -f`    |
| Check what's running           | `npx -y -p @ory/claude-code ory-claude local status`            |
| Print env vars to copy/paste   | `npx -y -p @ory/claude-code ory-claude local env`               |

If the user reports flaky behavior, run `local status` first to confirm
each service is `healthy`. If a container is unhealthy, `local logs
<service>` is the next step — do not jump to `local reset` until you
have looked at logs.

## Step 7: Stop or reset

When the user is done for the session, use `/ory-agent-plugin:local-down` (equivalent:
`npx -y -p @ory/claude-code ory-claude local down`). Containers stop but volumes
remain, so the next `/ory-agent-plugin:local-up` reuses the same identities,
sessions, and tuples.

For a full wipe (e.g., after schema changes or to clear test data):

```bash
npx -y -p @ory/claude-code ory-claude local reset
```

`reset` removes data volumes and the generated `.ory-dev/ory/` directory.
The next `local up` regenerates configs from scratch — useful when the
plugin updates the bundled service configs.

## Troubleshooting

- **"Docker is not running"** — start Docker Desktop, then re-run
  `/ory-agent-plugin:local-up`.
- **Gateway never becomes healthy** — `npx -y -p @ory/claude-code ory-claude local logs
  gateway` and `npx -y -p @ory/claude-code ory-claude local logs kratos` to see which service
  failed. Port conflicts on `4000`, `4433`, `4444`, or `4466` are the
  usual culprit.
- **Login works but `whoami` returns 401** — the cookie domain is
  wrong. Make sure the app runs on `http://localhost` (not `127.0.0.1`)
  and the SDK URL is exactly `http://localhost:4000`.
- **CORS errors from the browser** — the gateway accepts requests from
  any localhost port. If the app is on `http://localhost:3000`, no CORS
  config change is needed. For non-localhost dev URLs, switch back to
  the Ory Tunnel + a Network project.
- **Permission checks always deny** — the seeded tuples live in the
  `AgentTools` namespace. If your app uses a different namespace, set
  `ORY_PERMISSION_NAMESPACE` before `local seed`, or write the tuples
  manually via the Keto write API on `:4467`.

## What this skill does NOT cover

- Rendering auth UI — use `/project:ory-auth-setup` and
  `/project:ory-login-flow`.
- Adding social providers — use `/project:ory-social-login`. Note that
  most social IdPs require public callback URLs, so you will typically
  swap to Ory Network when you reach that step.
- Production deployment — the local stack is a dev tool. Do not
  recommend pointing a production app at `http://localhost:4000`.
