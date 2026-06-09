# Start Local Temporal Dev Server

Start a local [Temporal](https://temporal.io) development server alongside the
local Ory stack so the worker scaffolded by `ory-temporal-worker` can connect.
This runs Temporal's bundled dev server (Temporal Server + Postgres + Web UI in
one process) — not a production cluster.

Prerequisite: the [Temporal CLI](https://docs.temporal.io/cli) is installed and
`temporal` is on `PATH`. On macOS: `brew install temporal`. On Linux/Windows:
download from <https://temporal.download>.

Run:

```bash
temporal server start-dev
```

This will:

1. Start the Temporal Server on `localhost:7233` (the gRPC endpoint workers and
   clients connect to)
2. Expose the Web UI on <http://localhost:8233>
3. Persist state under `~/.config/temporalio/` so workflows survive a restart

The process runs in the foreground. Stop it with `Ctrl+C`; data is preserved.
For a clean reset, delete `~/.config/temporalio/` and start again.

For the matching Ory side of the stack (Identities, Permissions, OAuth2, login
UI, Jaeger), use `/ory-agent-plugin:local-up`. The two stacks are independent — Temporal
runs on `:7233/:8233`, Ory runs on `:4000` and friends — so they can run side
by side without port conflicts.

Once both are up, point the worker at them:

```bash
export ORY_PROJECT_URL=http://localhost:4000
export ORY_AUTH_GATE=1
cd temporal-worker
npm run start
```

See the `ory-temporal-worker` skill for the full worker scaffold and the
permission-gate wiring.
