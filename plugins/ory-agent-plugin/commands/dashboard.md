# Open the Ory Plugin Dashboard

Open a live, browser-based control panel for the Ory agent plugin. It shows
the health of the core Ory services the plugin uses (Kratos, Hydra, Keto) and
the plugin's current configuration (project URL, permission mode, audit mode,
user-login flag, namespaces, and the resolved user/agent identities),
refreshing the health status live.

Run:

```bash
npx -y -p @ory/claude-code ory-claude dashboard
```

This will:

1. Start a small local web server bound to `127.0.0.1`
2. Open your default browser at the dashboard
3. Refresh the service health live

The dashboard is the read-only status view of the Ory Agent web app — the same
local React UI, loopback server, and styleguide that power the guided web
installer. It never changes configuration. Stop it with `Ctrl-C` in the
terminal (or the "Close" button in the page).

When no browser is available (CI, SSH, headless), or with `--json`, it prints a
machine-readable status report instead:

```bash
npx -y -p @ory/claude-code ory-claude dashboard --json
```

If the core services show as unreachable, start the local stack with
`/ory-agent-plugin:local-up` (or check state with `npx -y -p @ory/claude-code ory-claude local status`).
