---
name: ory-deploy-openai-e2b
description: Build and deploy a Python OpenAI Agents SDK application in E2B with `ory-openai-agents`, the `ory-agent` CLI, and an Agent Security Talos deployment credential. Use when the user asks to build, secure, or deploy an OpenAI agent on E2B, including a prompted web-page generator.
---

# Build and deploy an OpenAI agent on E2B

Use this playbook to turn the user's intent into a complete, secured deployment:

- Python with the OpenAI Agents SDK
- `ory-openai-agents` at every function-tool boundary
- an immutable, credential-free E2B template
- Agent Security runtime `e2b` and recipe `e2b-sandbox` `v1`
- a generated `talos_api_key` managed through the `ory-agent` CLI

The user should be able to ask for an agent in product terms. Inspect the repository,
preserve its package manager and conventions, scaffold the application and controller,
run validation, and deploy it through the commands below. Ask before overwriting an
existing application or revoking a deployment. Reuse the deployment package across
agent sessions and revoke it only when the user intends to retire that registered
agent. Ask for missing credentials; never fabricate them.

Use `ory-build-agent` for another SDK and `ory-deploy-agent` for the canonical Claude
Agent SDK Docker/Kubernetes deployment. Use `ory-e2b-sandbox` only when installing an
Ory coding-harness plugin into an E2B image; do not combine that recipe with this Agent
SDK application deployment.

## Security boundaries

Keep these components separate:

1. The trusted controller holds `E2B_API_KEY`, `OPENAI_API_KEY`, and the deployment
   deployment values in memory.
2. The E2B template contains only source and pinned dependencies. It contains no
   credentials and no Agent start command.
3. The sandbox receives `OPENAI_API_KEY` and `ORY_*` only in the Agent command's
   `envs`. A credential-free preview process must not inherit them.
4. Agent Security owns the Agent identity, root delegation, Talos credential, policy,
   activation, and activity records. It does not provision E2B resources.

Never print, inspect, commit, upload, or place in a prompt:

- `OPENAI_API_KEY` or `E2B_API_KEY`
- `ORY_AGENT_API_KEY`
- any deployment credential value
- a user OAuth2 token

Never inject `ORY_USER_OAUTH2_TOKEN` into E2B. The deployment package is a complete
headless runtime identity and skips browser login. Always kill the sandbox after use;
never pause, snapshot, or fork it after credentials have entered it.

## Prerequisites

Require:

- a pinned published `ory-agent` release
- Python 3.10 or newer and the repository's Python package workflow
- an authenticated Ory Agent Plugin session for deployment administration
- `E2B_API_KEY` and `OPENAI_API_KEY` in the trusted controller environment
- project-level Talos rate limiting enabled before relying on deployment quotas

Check Ory authentication without exposing its token:

```bash
ory-agent auth status
```

Stop if the catalog-selected coordinated `ory-openai-agents` and `ory-argus` release
does not exist in the approved Python registry. Pin the tested OpenAI SDK and coordinated
Ory release, including transitives, in the repository's lock file. Do not use `latest`.

## Scaffold the application

For a web-page generator, create this shape unless the repository already establishes
another layout:

```text
app/agent.py
app/preview.py
controller/launch.py
tests/test_agent.py
requirements.in
requirements.lock
template.py
```

The sandbox must not contain the E2B SDK; only the external controller creates E2B
resources. Expose narrow function tools instead of shell access. For a static page
generator, use a fixed output directory, fixed filenames, prompt and output size limits,
and HTML/CSS only.

Use one shared Ory client for the input guardrail and completion hooks. OpenAI tool-input
guardrails belong on each `FunctionTool`, not on `Agent`:

```python
import sys
from pathlib import Path
from uuid import uuid4

from agents import Agent, Runner, function_tool
from ory_argus import OryAgentClient, with_hook_context
from ory_openai_agents import ory_run_hooks, ory_tool_input_guardrail

OUTPUT_DIR = Path("/workspace/output")
MAX_FILE_BYTES = 256_000
ory = OryAgentClient.from_env("openai-agents")
ory_guardrail = ory_tool_input_guardrail(client=ory)


def write_bounded(name: str, content: str) -> None:
    encoded = content.encode("utf-8")
    if len(encoded) > MAX_FILE_BYTES:
        raise ValueError(f"{name} exceeds {MAX_FILE_BYTES} bytes")
    (OUTPUT_DIR / name).write_bytes(encoded)


@function_tool(tool_input_guardrails=[ory_guardrail])
def write_web_page(index_html: str, styles_css: str) -> str:
    """Write one static web page to the fixed preview directory."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    write_bounded("index.html", index_html)
    write_bounded("styles.css", styles_css)
    return "Wrote index.html and styles.css"


agent = Agent(
    name="Web Page Builder",
    instructions=(
        "Create an accessible responsive static page. Call write_web_page exactly once. "
        "Do not generate JavaScript, forms, remote resources, network requests, analytics, "
        "automatic navigation, or secrets."
    ),
    tools=[write_web_page],
)


def run(prompt: str, *, session_id: str | None = None) -> str:
    with with_hook_context(ory, session_id=session_id or uuid4().hex):
        status = "error"
        try:
            result = Runner.run_sync(agent, prompt, hooks=ory_run_hooks(client=ory))
            status = "ok"
        finally:
            ory.logger.activity(
                "session.end",
                status,
                attributes={"harness": "openai-agents"},
            )
            if not ory.flush_events(timeout=3):
                print("Agent Security activity flush did not complete", file=sys.stderr)
    return str(result.final_output)
```

Every side-effecting local function tool needs the Ory guardrail. Hosted tools and model
built-ins do not pass through a function-tool guardrail; do not claim they are protected.
Installing the adapter alone protects nothing. Keep the entire Runner invocation, terminal
session activity, and event flush inside one `with_hook_context`; use a controller-owned stable
job or conversation ID when available, otherwise generate a new opaque ID for each run.

Add a fixed probe mode that runs the same OpenAI `Runner` and instructs the model to call
`write_web_page` exactly once with known harmless content. Do not invoke the Python tool
function directly: the probe must exercise session start, Talos authentication,
authorization, tool execution, completion activity, and event flush.

Serve generated files from a separate process with a restrictive CSP: no scripts,
connections, forms, framing, base URI, remote resources, or MIME sniffing. Do not pass the
Agent command environment to the preview process.

Test prompt bounds, output bounds, fixed paths, allowed execution, enforce-mode denial,
shared-client guardrail/hooks wiring, and secret-free source and fixtures. Run formatting,
lint, unit tests, and a real-SDK compatibility test before building the template.

## Build an immutable E2B template

Generate a Python E2B template that installs the locked dependencies and copies only the
application:

```python
from e2b import Template

template = (
    Template()
    .from_ubuntu_image("22.04")
    .apt_install(["python3", "python3-pip"])
    .set_workdir("/workspace")
    .copy("requirements.lock", "/workspace/requirements.lock")
    .run_cmd("python3 -m pip install --no-cache-dir -r requirements.lock")
    .copy("app", "/workspace/app")
    .make_dir("/workspace/output", mode=0o700)
)
```

Do not configure the Agent as a template start command: sandbox-creation credentials do
not exist during the template build. Build in a trusted release environment, scan source
and logs for secret markers, and record the returned immutable build ID. Production must
use `<template-name>:<build-id>`, never a moving tag or bare build ID.

## Initialize the Agent Security deployment

Generate the supported manifest and workflow through the CLI rather than hand-writing
the API request:

```bash
ory-agent init \
  --name web-page-generator \
  --agent-type openai-agents \
  --runtime-id e2b \
  --package-recipe e2b-sandbox \
  --package-recipe-version v1 \
  --credential-method talos_api_key
ory-agent deployment validate
```

The resulting `.ory/agent.yaml` must contain this selection and no project, owner, or
credential values:

```yaml
agent_type: openai-agents
runtime_id: e2b
package_recipe: e2b-sandbox
package_recipe_version: v1
credential_method: talos_api_key
```

Review the validation output. Then let the CLI create or reuse the durable deployment and
launch the trusted E2B controller for a session:

```bash
ory-agent deployment run \
  --result-file "$RUNNER_TEMP/ory-agent-result.json" \
  -- trusted-e2b-controller --credentials-stdin
```

The CLI stores the reusable credential in a protected mode-`0600` file and sends
it only through the child process's anonymous stdin, never public stdout, a shell
variable, or a log. It strips deployment-administration credentials from the
child environment. The atomic result records whether the deployment was created
or reused. `run` waits for **Active** after the controller succeeds and retains
the registered agent on success or failure so later sessions use the same policy.
Revoke explicitly only when retiring the deployment package.

## Launch through the trusted controller

Load credential stdin into a validated in-memory map without logging it. Require
exactly the deployment variables emitted by Agent Security, including
`ORY_AGENT_API_KEY`, `ORY_AGENT_SUBJECT_ID`, and `ORY_AGENT_ROOT_DELEGATION`. Add
`OPENAI_API_KEY` only to the Agent command environment.

The controller must:

1. Authenticate and rate-limit its caller.
2. Create a sandbox from the exact `<template-name>:<build-id>` with a bounded lifetime.
3. Disable public traffic unless preview is required.
4. Deny outbound traffic by default and allow only the exact OpenAI, Agent Security, Ory
   project, and required application hosts.
5. Write the bounded prompt to a file rather than a shell argument.
6. Run the Agent with `sandbox.commands.run(..., envs=agent_env, timeout=...)`.
7. Start preview separately without `envs=agent_env`.
8. Kill the sandbox in every failure, cancellation, expiry, and completion path.

Do not put deployment values in `Sandbox.create(..., envs=...)`; command-scoped injection
keeps them away from unrelated processes. E2B environment values remain visible inside
the sandbox OS, so run only the intended customer application there.

When exposing a preview, set `allow_public_traffic` to false, keep the E2B traffic access
token in the controller, and proxy through a dedicated authenticated preview origin.
Render generated content in a sandboxed iframe without same-origin, forms, popups, or
top-navigation privileges. Never return the traffic token to untrusted page content.

## Activate and validate

Agent Security changes a deployment from `ready` to `active` on its first authenticated
runtime request. Therefore use this order:

1. Launch a canary sandbox from the immutable build.
2. Run the fixed guarded probe inside it with command-scoped credentials.
3. Verify the expected output files exist without dumping process environment.
4. Run the user's page-generation prompt and validate the static output.
5. Exit successfully so `ory-agent deployment run` verifies **Active** and retains the deployment for the next session.

Start in Agent Security `observe`, review the recorded decision and activity, grant the
expected tool, deliberately promote policy to `enforce`, and prove an explicit deny keeps
the tool from writing output. Adapter infrastructure errors fail open, so E2B isolation,
narrow tools, egress restrictions, timeouts, and output validation remain required.

## Report

Report changed files, dependency locks, checks, immutable E2B build ID, non-secret
deployment ID and status, probe result, output validation, and blockers. Do not report
credentials, environment values, authorization headers, traffic tokens, prompts that may
contain sensitive data, or generated secret material. Leave a preview running only when
the user explicitly asks to inspect it and its controller owns a bounded cleanup lease.
