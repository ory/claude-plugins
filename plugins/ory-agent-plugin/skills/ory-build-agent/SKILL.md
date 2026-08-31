---
name: ory-build-agent
description: Build your own AI agent that authenticates the user, authorizes every tool call against Ory Permissions, and records structured activity — by dropping `@ory/argus` directly into the Claude Agent SDK, OpenAI Agents SDK, Mastra, Vercel AI SDK, PydanticAI / LangGraph, or as an external service called by Salesforce Agentforce. Use when the user wants to wire Ory into a custom agent they own — phrases like "add Ory to my own agent", "build a custom agent with Ory auth", "wrap my Claude Agent SDK tools with Ory permissions", "OpenAI Agents SDK with Ory", "Mastra agent with Ory permissions", "Agentforce action with Ory", "use `@ory/argus` directly". For wiring Ory into an existing agent harness (Claude Code, Codex, Gemini CLI, OpenClaw, OpenCode) use the corresponding `@ory/<harness>` plugin instead.
---

# Build your own agent with `@ory/argus`

You are helping the user wire Ory Identities, Permissions, and activity auditing into
**an agent they are building themselves**. They are not extending Claude Code,
Codex, or one of the other harness plugins — they own the agent loop and
choose where to intercept tool calls.

The integration is the same three moves regardless of SDK:

1. **Session start.** `sessionStart(client, …)` runs user and agent identity,
   delegation, permission-mode warming, and fail-open handling.
2. **Permission check on every tool call.** Wrap the SDK's tool dispatch with
   `gate(client, …)` and translate `result.blocked` into the SDK's veto signal.
3. **Completion.** Call `complete(client, …)` after the tool returns.

`@ory/argus` ships every helper and handles fail-open semantics (network
errors, rate limits, unconfigured project → allow). The SDKs differ only in
**where** that wrapper goes.

> **Precondition:** the user has an Ory project (or will spin up the local
> stack — see `/project:ory-local-dev`) and has the env vars from
> `/project:ory-auth-setup` figured out. Do not fabricate credentials or scaffold a
> project on their behalf.

## Step 1 — Pick the SDK and confirm the agent shape

Ask the user which SDK they're using and what the agent looks like. Below
are the SDKs this skill carries explicit recipes for. Others (LangChain,
LlamaIndex, generic OpenAI tool-calling loops) follow the same pattern —
wrap each tool dispatch with the gate from Step 4.

| SDK | Language | Where Ory hooks in |
|---|---|---|
| Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) | TypeScript / Python | `canUseTool` callback on `query({...})` |
| OpenAI Agents SDK (`@openai/agents`) | TypeScript | Per-tool `execute` wrapper or `RunHooks.onToolStart` |
| Salesforce Agentforce (Agent Builder) | declarative + Apex | External Service / side-car — see "Salesforce" below |
| Mastra (`@mastra/core`) | TypeScript | Higher-order wrapper around each tool's `execute` |
| Mistral AI (`@mistralai/mistralai` / `mistralai`) | TypeScript / Python | Per-tool wrapper inside the chat-completion loop or the Agents API tool registry |
| PydanticAI (`pydantic-ai`) | Python | `@agent.tool` decorator stack |
| Vercel AI SDK (`ai`) | TypeScript | Higher-order wrapper at `streamText({ tools })` |
| LangGraph (`langgraph`) | Python / TypeScript | `ToolNode` wrapper or `RunnableLambda` per tool |

Also establish:

- **Interactive vs headless.** Desktop / terminal agents can run PKCE login.
  Headless services (CI, daemons, Salesforce side-cars) must pre-supply
  `ORY_USER_OAUTH2_TOKEN`.
- **Which tools to gate.** Usually all of them. Some SDKs have built-in
  "safe" steps (an LLM-only reasoning step, a model-provided memory tool)
  that don't need a permission check.
- **Language.** `@ory/argus` is JavaScript-first. Python frameworks call out
  to a tiny Node side-car or use the official `ory-client` Python SDK
  directly; the snippet below shows the side-car shape.

## Step 2 — Install `@ory/argus`

```bash
npm install @ory/argus
```

That's the only Ory dependency you need. The Ory SDK clients
(`@ory/client`) and the OAuth2/PKCE plumbing are re-exported and ready to
use.

## Step 3 — Construct the client and start the session

Put this at the top of the agent's bootstrap, before the agent loop starts
processing the first message:

```ts
import {
  OryAgentClient,
  sessionStart,
} from "@ory/argus";

const client = OryAgentClient.fromEnv("my-agent");
await sessionStart(client, { harness: "my-agent" });
```

The user gate runs on every session and is always non-blocking: it refreshes
tokens, prompts on TTY, and emits the `user.auth` activity event, but always returns
`proceed: true`. A missing or declined login never stops the agent — the
consequence surfaces at the tool gate, where `permissionMode: enforce` denies
and `observe` audits.

## Step 4 — The shared gate body

This snippet is reused verbatim from every SDK-specific section in Step 5.
Put it next to where you construct the client.

```ts
import {
  complete,
  gate,
} from "@ory/argus";

async function gateTool(toolName: string, toolArgs?: unknown) {
  const result = await gate(client, { harness: "my-agent", toolName, toolArgs });
  return result.blocked
    ? { allow: false as const, message: result.denialMessage }
    : { allow: true as const };
}
```

After the tool finishes (whichever SDK), record completion activity:

```ts
complete(client, { toolName, output });
```

`gate` records permission and execution activity; `complete` records the terminal event.

## Step 5 — SDK-specific wiring

### Claude Agent SDK

The Claude Agent SDK exposes a `canUseTool` callback that fires before every
tool invocation. Drop the gate there:

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

const stream = query({
  prompt,
  options: {
    canUseTool: async (toolName, input, { signal }) => {
      const sessionId = currentSessionId(); // your own correlation id
      const gate = await gateTool(toolName, sessionId);
      if (!gate.allow) {
        return { behavior: "deny", message: gate.message };
      }
      return { behavior: "allow", updatedInput: input };
    },
  },
});

for await (const msg of stream) { /* standard handling */ }
```

`canUseTool` only fires for tools the SDK controls. If the agent also
registers MCP servers, wrap each MCP tool handler the same way — see the
`@ory/argus` `parseClaudeCodeMcpTool` / `checkMcpPermission` helpers for an
MCP-flavored version of the gate.

### OpenAI Agents SDK

The OpenAI Agents SDK supports per-run lifecycle hooks via `RunHooks` plus
per-tool `execute` overrides. Pick whichever you prefer:

```ts
import { Agent, Runner, tool } from "@openai/agents";

const search = tool({
  name: "search",
  description: "...",
  parameters: SearchParams,
  execute: async (input, ctx) => {
    const gate = await gateTool("search", ctx.runId);
    if (!gate.allow) return { error: gate.message };
    return realSearch(input);
  },
});

const agent = new Agent({ name: "my-agent", tools: [search], model: "gpt-4.1" });
await new Runner().run(agent, prompt);
```

For agent-wide enforcement without per-tool wrapping, register a
`on_tool_start` hook on the runner and throw on deny — the SDK surfaces the
throw to the model as a tool error.

### Salesforce Agentforce (Agent Builder)

Agentforce is a declarative agent inside the Salesforce platform — you
**cannot** embed `@ory/argus` in the agent process. Instead:

1. Stand up a small Node.js service that hosts the gated tools and exposes
   each as an HTTP endpoint. Inside that service, run Steps 3 + 4 exactly as
   above, then call `gateTool(...)` at the top of every handler.
2. Register the service in Salesforce as a **Named Credential** plus an
   **External Service** (OpenAPI 3 spec). Each operation becomes an
   Agentforce **Action**.
3. Define an Agentforce **Topic** whose actions call the External Service
   operations. The gate runs inside your Node service on every call; denies
   come back as tool errors the agent surfaces to the user.

Pre-supply `ORY_USER_OAUTH2_TOKEN` to the
side-car from a session the user established out-of-band — for example, a
PKCE flow at sign-on into the Experience Cloud site that fronts the agent.
A headless side-car cannot run PKCE on its own.

### Mastra Agent Framework

Mastra runs tools via `tool.execute({ context, runtimeContext })`. Wrap the
agent's tool registry at construction:

```ts
import { Agent } from "@mastra/core";

function gated<T extends { id: string; execute: (a: any) => Promise<any> }>(t: T): T {
  const original = t.execute.bind(t);
  return {
    ...t,
    execute: async (args: any) => {
      const sessionId = args.runtimeContext?.sessionId ?? "unknown";
      const gate = await gateTool(t.id, sessionId);
      if (!gate.allow) return { error: gate.message };
      return original(args);
    },
  };
}

const agent = new Agent({
  name: "my-agent",
  model,
  tools: Object.fromEntries(
    Object.entries(tools).map(([id, t]) => [id, gated(t)])
  ),
});
```

### Mistral AI

Mistral's SDK (`@mistralai/mistralai` for TypeScript, `mistralai` for
Python) exposes two surfaces. Both gate the same way.

**Chat-completion loop with tools.** You own the loop: call `chat.complete`,
inspect `tool_calls` on the response, run each tool, send the results back.
Gate inside the tool dispatcher:

```ts
import { Mistral } from "@mistralai/mistralai";

const client_ai = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

async function step(messages: any[], sessionId: string) {
  const res = await client_ai.chat.complete({
    model: "mistral-large-latest",
    messages,
    tools, // [{ type: "function", function: { name, parameters, description } }]
    toolChoice: "auto",
  });
  const choice = res.choices[0];
  if (!choice.message.toolCalls?.length) return choice.message;

  const toolResults = await Promise.all(
    choice.message.toolCalls.map(async (call) => {
      const gate = await gateTool(call.function.name, sessionId);
      if (!gate.allow) {
        return { toolCallId: call.id, name: call.function.name, content: gate.message };
      }
      const output = await runTool(call.function.name, JSON.parse(call.function.arguments));
      return { toolCallId: call.id, name: call.function.name, content: JSON.stringify(output) };
    })
  );
  return step(
    [...messages, choice.message, ...toolResults.map((r) => ({ role: "tool", ...r }))],
    sessionId
  );
}
```

**Mistral Agents API (la Plateforme).** When you use the managed Agents API
(`agents.create({ tools })`, `conversations.start`), Mistral runs the tool
loop server-side and only calls back to your code for tools it can't
execute itself — i.e. your "function" tools delivered via webhook. Wrap
each webhook handler with `gateTool(...)` and return either the result or
the gate's denial message. The server-side connectors (`web_search`,
`code_interpreter`, MCP connectors) execute inside Mistral and bypass your
gate — model them explicitly in your Ory namespace if you want to control
them, e.g. by writing per-connector tuples and skipping the agent
definition for users without the relation.

The same Python recipe applies via the `mistralai` package — replace the
`client_ai.chat.complete(...)` call with `client_ai.chat.complete(...)` from
the Python SDK and use the side-car pattern for `gateTool` (see
PydanticAI).

### PydanticAI (Python — covers the "Pi"-style framework slot)

Pure-Python agents don't link `@ory/argus` directly. The two supported
patterns:

- **Side-car HTTP service.** Run a small Node process that exposes
  `POST /gate` (calls `gateTool`). Your Python agent calls it from inside
  each `@agent.tool`.
- **Native Python integration.** Use `ory-argus`, which routes checks through
  the canonical Agent Security broker and preserves the same fail-open,
  observe/enforce, identity, and activity behavior as the TypeScript core.

Side-car pattern:

```python
from pydantic_ai import Agent, RunContext
import httpx

agent = Agent("openai:gpt-4.1", deps_type=AgentDeps)

@agent.tool
async def search(ctx: RunContext[AgentDeps], q: str) -> str:
    r = await httpx.post("http://localhost:5310/gate",
                          json={"tool": "search", "session": ctx.deps.session_id})
    if not r.json()["allow"]:
        return r.json()["message"]
    return real_search(q)
```

The same Python pattern applies verbatim to **LangGraph** (wrap each
`ToolNode` in a `RunnableLambda` that calls `/gate` first) and to
**LlamaIndex** agents (override `FunctionTool.acall`).

### Vercel AI SDK

The `ai` package's `tool()` helper produces descriptors consumed by
`streamText` / `generateText`. Wrap them at construction:

```ts
import { streamText, tool } from "ai";

function gated(name: string, def: ReturnType<typeof tool>) {
  return tool({
    ...def,
    execute: async (input, ctx) => {
      const gate = await gateTool(name, ctx.toolCallId);
      if (!gate.allow) return { error: gate.message };
      return def.execute(input, ctx);
    },
  });
}

await streamText({
  model,
  tools: { search: gated("search", searchTool), write: gated("write", writeTool) },
  prompt,
});
```

### LangGraph (TypeScript)

LangGraph's `ToolNode` runs a registered tool array. Wrap each tool the same
way Vercel AI SDK does, then pass the wrapped array to `new ToolNode(...)`.
The `gateTool` body does not change.

## Step 6 — Test against the local Ory stack

Before pointing at production, run the gate against the local stack so the
PKCE flow, permission tuples, and activity events are all visible:

1. `/ory-agent-plugin:local-up` — brings up Kratos / Keto / Hydra on `localhost:4000`
   and seeds a demo user. The banner prints the email + password.
2. Export the env vars the launcher writes (`ORY_PROJECT_URL`,
   `ORY_OAUTH2_CLIENT_ID`, and optionally `ORY_AGENT_LOG_FILE` to override the
   default unified NDJSON log). The user login runs every session.
3. Start your agent. Confirm the browser opens for PKCE login.
4. Invoke a gated tool and tail `<dataDir>/<harness>/ory-agent-debug.log` with
   `jq` — you
   should see `user.auth` → `agent.auth` → `permission.check` →
   `tool.complete` for every call.
5. Native tools are allowed unless explicitly blocked. Promote to enforce once
   the block policy is ready. The posture is a
   permission on the Ory project, read on every session — an admin sets it
   in the Ory Console (Agent Security); see the resolved value with
   `... permissions` via any harness CLI (same shared config file).
6. `/ory-agent-plugin:local-down` when done. Volumes persist, so the seeded user
   survives across runs.

For full env-var coverage (including the user/agent split,
`ORY_USER_SUBJECT_NAMESPACE`, agent DCR knobs), see `/project:ory-auth-setup`.

## What this skill does NOT do

- It does not generate the agent. The user owns the agent loop, tool
  catalog, and deployment shape. This skill only drops `@ory/argus` into
  whatever they already have.
- It does not write permissions. Native-tool blocks and MCP grants are
  provisioned in the Ory Console (Agent Security); `@ory/argus` only reads
  them. The local seed writes no baseline native-tool grants.
- It does not adapt one of the existing harness plugins (`@ory/claude-code`,
  `@ory/codex`, `@ory/gemini-cli`, `@ory/openclaw`, `@ory/opencode`). Those
  are for users running those harnesses — not building a custom agent.
- It does not invent SDK-internal types. The snippets are the canonical
  shape, but SDK hook signatures drift release-to-release — verify against
  the user's pinned version before pasting.
