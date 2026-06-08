# Start Local Ory Environment

Start the local Ory development environment using Docker Compose.
This spins up Kratos (identity), Keto (permissions), Hydra (OAuth2),
and an Nginx gateway on port 4000.

Run:

```bash
npx -y -p @ory/claude-code ory-claude local up
```

This will:

1. Start all Ory services in Docker containers
2. Wait for the gateway to become healthy
3. Seed test data (identity, session, and permission tuples)
4. Print environment variables to connect

After it completes, set the printed environment variables in your shell:

```bash
eval "$(npx -y -p @ory/claude-code ory-claude local env)"
```

If services are already running, stop them first with `/ory-agent-plugin:local-down`
or use `npx -y -p @ory/claude-code ory-claude local status` to check the current state.
