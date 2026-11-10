---
name: ory-deploy-agent
description: Build and deploy a headless TypeScript agent through Ory Agent Security using the Claude Agent SDK, `@ory/claude-agent-sdk`, the `ory-agent` deployment CLI, and either a generated Talos credential or customer-operated SPIFFE on Generic Docker or Kubernetes. Use for an end-to-end managed agent deployment or Agent Security deployment validation.
---

# Build and deploy an Agent Security managed agent

Use this playbook for the canonical validated application stack:

- TypeScript on Node.js 22
- `@anthropic-ai/claude-agent-sdk` with Ory's `createOryHooks`
- Generic Docker with Docker Compose, or Kubernetes
- Agent Security's `talos_api_key`, or customer-operated `spiffe_x509_svid`

Do not substitute another SDK in this workflow. Choose one runtime and credential
path deliberately; do not combine Talos and SPIFFE credentials.
Use `ory-build-agent` when the user asks for a different integration.
Use `/project:ory-deploy-openai-e2b` when the user asks to deploy a Python OpenAI
Agents SDK application on E2B; that skill owns the Talos and sandbox lifecycle.

## Safety

Work autonomously, but ask before overwriting an existing application. Never
print, inspect, commit, or place in a prompt:

- `ORY_USER_OAUTH2_TOKEN`
- `ANTHROPIC_API_KEY`
- any deployment credential value
- SPIFFE private keys or SVID file contents

The user OAuth2 token administers deployments as the signed-in identity. The
generated `ORY_AGENT_API_KEY` or customer-issued SVID is a separate runtime
credential. Never exchange their roles. A deployment package is the durable
registered agent; reuse it across sessions and revoke it only when the user is
retiring that agent and package.

## Prerequisites

Require Node.js 22 or newer, npm, Docker with `docker compose`, and Go 1.24 or
newer unless `ory-agent` is installed. Require only this application environment
value:

```text
ANTHROPIC_API_KEY
```

Agent Security must have a connected project URL, but it need not come from an
environment variable: the CLI reads the shared plugin config and its persisted
user login. Headless CI sets `ORY_PROJECT_URL` as connection configuration and
`ORY_USER_OAUTH2_TOKEN` to a user OAuth2 access token.
`ORY_AGENT_SECURITY_URL` is optional and defaults to
`https://agents.console.ory.com`.

Check the authenticated context without exposing a token:

```bash
ory-agent auth status
```

The server response is authoritative for the connected project and owner.

## Build the agent

Inspect the repository first and preserve its package manager and conventions.
For a new TypeScript application, install:

```bash
npm install @ory/argus @ory/claude-agent-sdk @anthropic-ai/claude-agent-sdk zod
npm install --save-dev typescript @types/node
```

Build a headless service with `GET /healthz` and `POST /run`. Wire the SDK at
its supported hook boundary, and consume the query stream:

```ts
import {
  createSdkMcpServer,
  query,
  tool,
  type Options,
} from "@anthropic-ai/claude-agent-sdk";
import { OryAgentClient } from "@ory/argus";
import { createOryHooks } from "@ory/claude-agent-sdk";
import { z } from "zod";

const deploymentProbe = tool(
  "deployment_probe",
  "Return a fixed deployment health marker",
  { marker: z.literal("ready").default("ready") },
  async ({ marker }) => ({
    content: [{ type: "text", text: marker }],
  }),
);

const deploymentServer = createSdkMcpServer({
  name: "deployment",
  version: "1.0.0",
  tools: [deploymentProbe],
});

const ory = OryAgentClient.fromEnv("claude-agent-sdk");

function options(): Options {
  return {
    tools: [],
    mcpServers: { deployment: deploymentServer },
    allowedTools: ["mcp__deployment__deployment_probe"],
    // The packages use compatible hook shapes without sharing SDK types.
    hooks: createOryHooks({ client: ory }) as unknown as Options["hooks"],
  };
}

async function runClaude(prompt: string) {
  const messages = query({
    prompt,
    options: options(),
  });
  for await (const message of messages) {
    // Convert the SDK result into the service's response shape.
  }
}

// POST /run passes the request prompt to runClaude.
// POST /probe passes a fixed prompt that requires deployment_probe.
await runClaude("Call deployment_probe exactly once and return its result.");
```

All tool execution must pass through these hooks. Add a local
`deployment_probe` tool using the Claude Agent SDK's supported tool/MCP surface.
Expose `POST /probe`, but do not invoke the tool implementation directly: run a
fixed Claude SDK `query` that instructs Claude to call `deployment_probe`, with
the same `createOryHooks()` wiring as `/run`. This intentionally makes a model
request so the validation exercises the real `SessionStart`, `PreToolUse`, and
`PostToolUse` lifecycle instead of claiming that a direct MCP call is secured by
hooks that never ran.

Add focused tests for health, the fixed probe query, hook wiring on both SDK
query paths, and the absence of embedded credentials. Run formatting, type
checking, tests, and the production build before deployment.

## Containerize

Create a production Dockerfile and either `compose.yaml` or Kubernetes workload
manifests. The service must receive `ANTHROPIC_API_KEY` by secret reference, bind
to `0.0.0.0`, expose the application port, and define a health check. Ignore
credentials, deployment state, dependencies, build output, and local environment
files in Git and the Docker context.

For Talos, the trusted deployment controller must inject the stdin values
directly into the workload's runtime secret facility without creating another
credential file. For SPIFFE, use the file-backed environment contract in
`examples/spiffe`: mount the parent of the atomically switched `current`
generation read-only, and point `ORY_AGENT_SPIFFE_GENERATION_PATH` at `current`.
TypeScript `OryAgentClient.fromEnv()` and Python `OryAgentClient.from_env()` use
the same variables and reload the certificate, private key, and trust bundle for
every broker request.

Run `docker compose config` without printing its environment section.

## Initialize and validate

Install a published, pinned coordinated CLI release, never `latest`. Obtain the
version from the release or package selected by the user; do not invent or
hardcode a future version in generated guidance:

```bash
go install github.com/ory/ory-agent-plugins/cmd/ory-agent@<release-version>
ory-agent init
ory-agent deployment validate
```

The generated manifest uses this identity-free shape:

```yaml
api_version: agent-security.ory.sh/v1
kind: AgentDeployment
name: my-sdk-agent
agent_type: claude-agent-sdk
runtime_id: generic-docker
package_recipe: docker-compose
package_recipe_version: v1
credential_method: talos_api_key
credential_ttl_seconds: 2592000
credential_rate_limit:
  quota: 600
  window_seconds: 60
```

For customer-operated SPIFFE connecting to hosted Agent Security, replace the
credential-specific fields with:

```yaml
credential_method: spiffe_x509_svid
spiffe_id: spiffe://customer.example/agent/my-sdk-agent
spiffe_trust_relationship_id: <active-trust-relationship-uuid>
```

Hosted mode omits both `agent_security_mtls_url` and `spiffe_server_id`. The
server supplies its Web-PKI mTLS endpoint, and the runtime uses system trust
roots with HTTPS hostname verification. A customer-operated portable Agent
Security deployment requires its explicit `agent_security_mtls_url` and may add
an exact `spiffe_server_id`; use the values supplied for that environment.
Do not attempt a hosted SPIFFE deployment until Agent Security advertises the
capability; hosted rollout remains gated on DNS and certificate convergence.
The deployment package supplies non-secret runtime identity configuration; the
customer's workload identity system supplies the SVID, private key, and bundle.
Do not put PEM material in the manifest or deployment package.

Do not add project or owner fields unless the user deliberately requests an
override. The CLI resolves both through remote `auth status`; an explicit
project is sent to the owner-scoped server route for validation, while an
explicit owner must equal the authenticated identity.

## Create and deploy

Let the CLI create or validate the durable deployment and launch the trusted
deployment controller for a session:

```bash
ory-agent deployment run \
  --result-file "$RUNNER_TEMP/ory-agent-result.json" \
  -- trusted-deployer --credentials-stdin
```

The CLI stores the credential in a protected mode-`0600` file, sends it only to
the child process's anonymous stdin, and never writes it to public stdout, a
shell variable, or a log. It strips deployment-administration credentials from
the child environment. The optional result identifies whether the deployment
was created or reused. Later invocations validate the same registered agent and
start another session with the same credential and policy.

The trusted controller must load stdin in memory, inject the values into the
workload secret facility, start and supervise the workload, verify `/healthz`,
invoke the guarded `/probe`, and exit only when that bounded workload run is
finished. For a long-running service, the controller must remain its supervisor;
do not detach and exit while the workload still needs the credential. After a
successful controller exit, the CLI waits for **Active** and retains the
deployment for future sessions. Controller failure also leaves the registered
agent intact. Use `ory-agent deployment revoke` only to retire the package.

## Customer-operated SPIFFE

SPIFFE is an integration contract, not an Ory-managed SPIRE installation. The
customer exclusively owns and operates:

- SPIRE or another conforming SPIFFE implementation
- workload and node attestation, selectors, and registration entries
- SVID and trust-bundle issuance, filesystem delivery, rotation, and revocation
- helper/CSI/sidecar availability and the permissions on mounted key material

Ory records the expected workload identity and authenticates broker requests.
Neither `ory-agent deployment run` nor the Ory packages install SPIRE, choose
selectors, create registrations, issue SVIDs, rotate files, or revoke workload
entries.

Use the generated file-backed contract exactly:

```text
ORY_AGENT_CREDENTIAL_METHOD=spiffe_x509_svid
ORY_AGENT_SPIFFE_ID=spiffe://customer.example/agent/my-sdk-agent
ORY_AGENT_SPIFFE_GENERATION_PATH=/run/ory-spiffe/current
ORY_SPIFFE_GENERATION_FILE=generation
```

`ORY_SPIFFE_GENERATION_FILE` is optional. When used, the customer-side writer
must update one generation directory completely, update its marker, and
atomically switch `current`. The application mount must include the parent
directory rather than bind-mounting the old symlink target. Direct-path mode is
also supported with all three of `ORY_AGENT_SPIFFE_SVID_PATH`,
`ORY_AGENT_SPIFFE_KEY_PATH`, and `ORY_AGENT_SPIFFE_TRUST_BUNDLE_PATH`, but an
atomic generation directory is preferred for rotation.
Hosted mode must leave `ORY_AGENT_SPIFFE_SERVER_ID` unset so the runtime uses
system roots and hostname verification. For customer-operated portable Agent
Security, set `ORY_AGENT_SECURITY_URL` to its explicit mTLS URL and optionally
set `ORY_AGENT_SPIFFE_SERVER_ID` to the exact server workload ID.

Use `examples/spiffe/docker/compose.yaml` as the Generic Docker contract. It
expects the customer's material writer on the host and mounts its output
read-only. Use `examples/spiffe/kubernetes/deployment.yaml` as the Kubernetes
contract. It expects a customer-provisioned `customer-spiffe-material` PVC; adapt
that volume to the customer's CSI/helper pattern without adding SPIRE lifecycle
resources to the application deployment.

Before production, run the local contract tests and then validate these states
in the customer's non-production identity domain:

1. Package configuration: both TypeScript and Python resolve an injected SPIFFE
   credential and do not use `ORY_AGENT_API_KEY`.
2. Authentication: a valid SVID reaches Agent Security over TLS 1.3 mTLS;
   hosted mode verifies the Web-PKI hostname, while portable mode matches the
   exact server SPIFFE URI SAN when one is configured.
3. Authorization: an allowed `deployment_probe` runs; the same tool is blocked
   after an explicit deny in enforce mode.
4. Rotation: atomically switch `current`; the next request uses the new SVID
   without restarting the application.
5. Revocation: revoke the customer-owned registration/SVID and confirm the next
   request fails authentication without falling back to Talos. Separately,
   `ory-agent deployment revoke` revokes the Ory deployment record only; it does
   not delete a SPIRE registration.

## Report

Report changed files, format/typecheck/test/build results, Docker health,
non-secret deployment ID and status, fixed-query and user-query probe results,
activation status, and blockers. Never report credentials, environment values,
authorization headers, or credential-file contents. The trusted controller must
clean up its bounded workload before exiting; `deployment run` then retains the
same Agent Security deployment for the next session.
