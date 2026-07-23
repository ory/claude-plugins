---
name: ory-temporal-worker
description: Scaffold a [Temporal](https://temporal.io) TypeScript worker where every Activity execution is gated by Ory — the user is authenticated, the worker's agent identity is resolved via DCR, each Activity invocation runs an Ory Permission check, and the full lifecycle emits trace spans. Use when the user asks to "add Ory to my Temporal worker", "wire Ory permissions into Temporal activities", "create a Temporal worker with Ory auth", "build a Temporal TypeScript project with the Ory agent client", or any close variant. The skill scaffolds the project in the user's repo following <https://docs.temporal.io/develop/typescript/set-up-your-local-typescript> — it does not run the worker.
---

# Ory-authed Temporal TypeScript worker

You are helping the user scaffold a [Temporal](https://temporal.io) TypeScript
worker where every Activity execution is gated by Ory: the user is
authenticated, the worker's agent identity is resolved via OAuth2 Dynamic Client
Registration, each Activity invocation runs an Ory Permission check, and the
full lifecycle emits trace spans. **Workflows stay deterministic** — only
Activities call out to Ory.

This skill carries the workflow. You generate the files in the user's repo; the
user runs the Temporal CLI and the worker.

> **Precondition:** Node.js 20+ is installed, and the user has installed (or
> will install) the [Temporal CLI](https://docs.temporal.io/cli). On macOS:
> `brew install temporal`. On Linux/Windows: download from
> <https://temporal.download> and put `temporal` on `PATH`. If the binary is
> missing, point the user at the docs and stop — do not fabricate it.

## Step 1 — Confirm the target

Before writing files, confirm with the user:

1. **Where the worker should live.** Default to `temporal-worker/` at the repo
   root unless the user says otherwise.
2. **Task queue name.** Default `agent-tools`. The worker and the workflow
   starter must agree on this string.
3. **Ory project URL.** For local development point at the local Ory stack
   (`/ory-agent-plugin:local-up`) on `http://localhost:4000`. For Ory Network, the user
   plumbs their project URL through the worker's env. Either way the worker
   needs network reachability to the Ory APIs at runtime.

## Step 2 — Scaffold the Temporal project

Run the official Temporal scaffold and select the `hello-world` sample when
prompted. Then add the Ory agent client:

```bash
npx @temporalio/create@latest temporal-worker
cd temporal-worker
npm install @ory/argus
```

The scaffold lays down `src/{activities.ts, workflows.ts, worker.ts, client.ts}`
and pre-configures the Worker to connect to the Temporal dev server at
`localhost:7233`. The Web UI lives at <http://localhost:8233> once the dev
server is running.

## Step 3 — Wrap Activities with the Ory gate

Activities are where side effects happen, so they are the right place to put
the permission check. **Never call Ory from inside a Workflow** — Workflows are
deterministic and replayed; a live Ory call would break replay safety.

Replace the scaffold's `src/activities.ts` with:

```ts
import { Context } from "@temporalio/activity";
import {
  OryAgentClient,
  ensureUserAuthenticated,
  ensureAgentIdentity,
  checkAndDecide,
  resolveUserSubject,
  subjectLabel,
} from "@ory/argus";

// One client per worker process. `harness` is a label that shows up on
// every trace span so worker-originated audit lives in its own namespace
// alongside the CLI plugins.
const ory = OryAgentClient.fromEnv("temporal");

// Run the user + agent gates exactly once per process. Activities call
// `bootstrap()` lazily and await the same promise on subsequent calls.
let bootstrapped: Promise<void> | undefined;
function bootstrap(): Promise<void> {
  if (!bootstrapped) {
    bootstrapped = (async () => {
      await ensureUserAuthenticated(ory, {
        binName: "temporal-worker",
        harness: "temporal",
        // The user gate runs every invocation and never blocks: it refreshes
        // tokens and emits the audit span, but the worker proceeds even if the
        // user is unauthenticated. Enforcement happens at the per-Activity
        // permission check (permissionMode).
      });
      await ensureAgentIdentity(ory, {
        projectUrl: process.env.ORY_PROJECT_URL,
      });
    })();
  }
  return bootstrapped;
}

async function gate(toolName: string, userSubject: string): Promise<void> {
  await bootstrap();
  const subject = resolveUserSubject(ory, userSubject);
  const decision = await checkAndDecide(
    ory,
    {
      namespace: process.env.ORY_PERMISSION_NAMESPACE ?? "AgentTools",
      object: toolName,
      relation: "use",
      ...subject,
    },
    {
      spanAttributes: {
        toolName,
        workflowId: Context.current().info.workflowExecution.workflowId,
        activityId: Context.current().info.activityId,
      },
    }
  );

  switch (decision.kind) {
    case "allow":
    case "observe":
    case "fail_open":
      return;
    case "deny":
      throw new Error(
        `Ory denied use of ${toolName} for ${subjectLabel(subject)}`
      );
  }
}

export async function sendEmail(input: {
  user: string;
  to: string;
  subject: string;
}): Promise<string> {
  await gate("send_email", input.user);
  // …real side effect here…
  return `sent to ${input.to}`;
}
```

Key choices:

- **Activities call Ory, Workflows don't.** Anything that needs a live decision
  goes in an Activity. Workflows only orchestrate.
- **The user gate never blocks.** It runs every invocation to refresh the user
  identity, but always proceeds. Enforcement is at the permission check, which
  throws on deny — Temporal will mark the Activity as failed and surface the
  error via the Workflow result or retry policy.
- **`harness: "temporal"`.** Distinguishes worker-originated spans in the trace
  file from CLI plugin spans.
- **Span attributes carry the Workflow + Activity IDs.** This is how operators
  correlate Ory denials back to Temporal executions in the Web UI.

## Step 4 — Pass the user subject through the Workflow

Workflows must be deterministic, so they cannot read `process.env` or call out
to Ory. The user subject travels as Workflow input. Update `src/workflows.ts`:

```ts
import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";

const { sendEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
});

export async function notifyUser(input: {
  user: string;
  to: string;
}): Promise<string> {
  return sendEmail({
    user: input.user,
    to: input.to,
    subject: "hello",
  });
}
```

And `src/client.ts`:

```ts
import { Connection, Client } from "@temporalio/client";
import { nanoid } from "nanoid";
import { notifyUser } from "./workflows";

const client = new Client({ connection: await Connection.connect() });
const handle = await client.workflow.start(notifyUser, {
  taskQueue: "agent-tools",
  workflowId: `notify-${nanoid()}`,
  args: [{ user: "user@example.com", to: "alice@example.com" }],
});
console.log("workflow started:", handle.workflowId);
console.log("result:", await handle.result());
```

`src/worker.ts` stays as the scaffold writes it — `Worker.create` already
registers Workflows and Activities together and listens on the task queue.

## Step 5 — Run it

Three terminals. See `/ory-agent-plugin:local-up` for the Ory side; the Temporal side uses
the Temporal CLI's bundled dev server (Postgres + Temporal Server + Web UI in
one process):

```bash
# Terminal 1 — local Ory stack (Kratos, Keto, Hydra, gateway)
`/ory-agent-plugin:local-up`

# Terminal 2 — local Temporal dev server (Web UI at http://localhost:8233)
temporal server start-dev

# Terminal 3 — the worker, pointed at both
cd temporal-worker
export ORY_PROJECT_URL=http://localhost:4000
export ORY_AUTH_GATE=1
export ORY_AGENT_DEBUG=true
export ORY_AGENT_TRACE_FILE=$PWD/ory-trace.ndjson
npm run start                 # boots the worker, polls task queue
```

In a fourth terminal, kick the workflow once:

```bash
cd temporal-worker
npm run workflow
```

Tail the trace file to confirm the gates fired:

```bash
tail -f ory-trace.ndjson | jq .
```

You should see:

- exactly one `user.auth` span (the worker's first Activity triggered
  `bootstrap()`),
- exactly one `agent.auth` span,
- one `tool.invoke` (allow) or `tool.block` (deny) span **per Activity
  execution**.

The Workflow itself produces no Ory spans — only its Activities do.

## Step 6 — Promotion from observe to enforce

The worker starts in `observe` mode by default: denies pass through but each is
recorded as a `permission.observe_deny` audit span. Once the user has confirmed
the deny set is what they expect, promote to enforcement:

```bash
export ORY_PERMISSION_MODE=enforce
```

On a fresh Ory project, run the permissions bootstrap once before flipping the
switch so the `use` tuples for each Activity name (`send_email`, …) exist —
see `/project:ory-permissions-onboarding`.

To exercise the deny path locally, write a tuple that explicitly removes `use`
for the test user against one Activity object, kick the Workflow, and watch the
Activity fail with the `Ory denied use of …` error in the Temporal Web UI.

## Step 7 — Beyond the dev server

This skill stops at the local dev server. For production:

- Pin a static agent identity with `ORY_AGENT_API_KEY` (single key) or
  `ORY_AGENT_CLIENT_ID + ORY_AGENT_CLIENT_SECRET` (client_credentials) so the
  worker doesn't re-register on every cold start.
- Persist the worker's `ory-trace.ndjson` somewhere durable, or replace the
  file tracer with an OpenTelemetry exporter wired up around `ory.tracer`.
- Use Temporal Cloud or a self-hosted Temporal cluster instead of
  `temporal server start-dev`; the worker code does not change.

## What this skill does NOT do

- It does not modify the user's Ory project — use `/project:ory-auth-setup` for that.
- It does not call Ory from inside a Workflow. Workflows are deterministic and
  must never make non-deterministic calls; all gating lives in Activities.
- It does not deploy the worker. The user runs `temporal server start-dev` and
  `npm run start` locally; production deployment is out of scope.
- It does not pin Temporal or `@ory/argus` versions. For reproducibility, pin
  both in the generated `package.json` before committing.
