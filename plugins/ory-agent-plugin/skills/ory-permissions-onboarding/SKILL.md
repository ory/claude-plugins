---
name: ory-permissions-onboarding
description: Onboard a fresh install onto Ory Permissions for AI agent tool calls. Use when the user has just installed the Ory plugin and wants per-tool authorization enforced without first getting blocked by missing permissions. Covers connecting the plugin, reading coverage in observe mode, and what has to happen in the Ory Console (grants, blocks, enforce posture).
---

# Onboard onto Ory Permissions for Agent Tool Calls

You are helping a user move a freshly-installed Ory agent plugin from
"disconnected" to "permissions are enforcing", without the common
first-run failure mode of getting every tool call blocked because the
project has no grants yet.

**The plugin only reads permissions. It never writes them.** Everything
that provisions the project — the permission model, per-tool grants,
explicit blocks, and the observe/enforce posture — is done in the **Ory
Console** (Agent Security) by someone with access to the project. That
split is deliberate: it means installing and connecting a plugin needs
nothing but project connection details and a public OAuth2 client id, with no
workspace privilege and no project API key.

Two things govern behavior:

- **Whether Agent Security is connected** — it runs when a project URL,
  canonical Agent Security origin, and public OAuth2 client id resolve. Existing
  configurations fall back to the project URL when the canonical origin is
  unset. Not connected means no login and no permission checks, with
  tool calls recorded locally. Skills, commands, the local dev stack, and
  the MCP server work either way — they don't need a project at all.
- **`permissionMode`** — `observe` or `enforce`, **read from the Ory
  project** on every session, and only meaningful once connected.
  `observe` (the default) runs every check, records denials, and lets the
  tool proceed. `enforce` blocks on deny. There is no local override — an
  admin sets it in the Console.

The journey: **install → connect → observe → grant in the Console →
enforce in the Console.**

## Step 1: Connect the plugin to the project

A fresh install has the developer-experience half working and Agent
Security not connected. Copy the connection details shown in the Ory Console
under **Agent Security**:

```sh
npx -y -p @ory/claude-code ory-claude configure --project-url <URL> --agent-security-url <URL>
```

- **project URL** — the project's SDK URL (`https://<slug>.projects.oryapis.com`).
- **Agent Security URL** — the canonical broker origin (`https://agents.console.ory.com` in production).
- **OAuth2 client id** — the project's public login client, provisioned
  in the Console. The per-session user login needs it to complete its
  PKCE browser flow.

Then confirm what the plugin resolved:

```sh
npx -y -p @ory/claude-code ory-claude status
```

What you want to see:

- **Project URL**: a real Ory URL or your local dev gateway (not "NOT SET").
- **OAuth2 Client**: the project's public login client (not "NOT SET").
- **Agent Security**: connected. If it says "not connected", it names the
  unresolved connection value.

If the user doesn't have those values, they need them from whoever
administers the project. Don't try to create the client from here — the
plugin has no privilege to, by design.

## Step 2: Look at the current permission posture

```sh
npx -y -p @ory/claude-code ory-claude permissions
```

This prints:

- The live **permission mode** (`observe` or `enforce`) and whether it
  came from the project, a cached value, or the default.
- The **subject** — the user identity permissions are checked against.
- For each tool in this harness's built-in catalog, **allowed / denied /
  blocked / errored**, from a real check against the project right now.
- A one-line coverage summary for decomposed shell command words.

On a freshly-connected project you will usually see every tool reported
as **denied** — no grants exist for this user yet. In observe mode that
blocks nobody: tool calls run through, and you are seeing what *would*
be blocked under enforce.

If status prints `Mode: enforce` while tools are denied, tool calls
**are** being blocked right now. The fix is in the Console (grant the
tools, or move the project back to observe) — not from the CLI.

## Step 3: Run a real session in observe mode

Observe mode is the discovery phase. Use the harness normally, then look
at what was recorded:

```sh
npx -y -p @ory/claude-code ory-claude status          # summary + recent activity
npx -y -p @ory/claude-code ory-claude watch           # live event, decision, and error view
```

Launch the harness with `ORY_AGENT_DEBUG=true` to include verbose diagnostics in
the watched log and stderr. Denials appear as `permission.observe_deny` activity events (and
`permission.block_observed` for an explicit block), with the tool name
and the subject. That list is exactly what has to be granted before
enforce is safe.

## Step 4: Grant the tools in the Ory Console

In the Ory Console → **Agent Security**, grant the subject `use` on the
tools it needs. The grant shape the runtime checks is:

```
namespace: AgentTool           (or whatever ORY_PERMISSION_NAMESPACE is set to)
object:    <tool name>          (e.g. Read, Bash, WebFetch)
relation:  use
subject:   User:<id>            (a SubjectSet — namespace `User`, object the user id)
```

Notes worth passing on to the user:

- The subject is a **SubjectSet** (`User:<id>`), which is what the
  Console's *Add relationship* dialog emits and exactly what the runtime
  check uses. A bare subject id will not match.
- Granting a **group** and putting users in it scales better than
  per-user grants; the check follows subject-set expansion.
- **Shell command words** are authorized separately in the `ShellTool`
  namespace (`ShellTool:curl#use`, …) because a denied surface is
  otherwise reachable through `bash -c "curl …"`.
- **MCP server tools** are discovered dynamically per session, so they
  are not in the built-in catalog and need granting as they come into
  scope.

Re-run `npx -y -p @ory/claude-code ory-claude permissions` afterwards to confirm coverage.

## Step 5: Promote to enforce in the Console

Once the tools the user actually needs report `allowed`, an admin flips
the posture in the Console (Agent Security). The mode is a permission on
the project, so it can be set **project-wide** — covering principals
that don't exist yet — or **per principal** as an exception.

Every session reads the live mode, so the change takes effect without
reinstalling or reconfiguring anything. Confirm it landed:

```sh
npx -y -p @ory/claude-code ory-claude permissions
```

## Step 6: Verify a real session under enforce

Start a normal agent session and confirm:

- **Allowed tools** invoke without complaint.
- **Denied tools** are blocked with a clear "Ory: permission denied"
  message naming the tool (or the shell command word).
- The activity log shows `permission.check` events per tool call and
  `tool.block` events for denials.

If a tool is unexpectedly blocked, run `npx -y -p @ory/claude-code ory-claude permissions` to
see whether it is `denied` (no grant) or `blocked` (an explicit
deny-override), then fix it in the Console and re-test.

## Explicit blocks (deny-override)

Granting is additive. To express the opposite — a subject is **blocked**
from a tool, beating any grant, including one inherited through a group —
an admin writes a `blockedSubjects` relation in the Console. Ory evaluates it
natively (the `use` permit is "granted AND not blocked"), so it holds
no matter how the grant was reached.

A block behaves like any other deny: under **observe** it is recorded (a
`permission.block_observed` activity event) but the tool still runs; under
**enforce** it blocks. `permissions` marks blocked tools so they
are distinguishable from a plain missing grant at a glance.

## Reference

| Command | Effect |
|---|---|
| `npx -y -p @ory/claude-code ory-claude configure --project-url <URL> --agent-security-url <URL>` | Connect the plugin to the canonical Agent Security broker. |
| `npx -y -p @ory/claude-code ory-claude configure --disconnect` | Turn sign-in and permission checks back off. Skills, commands, the local stack, and activity logging are unaffected. |
| `npx -y -p @ory/claude-code ory-claude permissions` | Print the live mode + per-tool allowed/denied/blocked breakdown. Read-only. |
| `npx -y -p @ory/claude-code ory-claude status` | Configuration, identities, permission coverage, recent activity. |

Done in the **Ory Console** (Agent Security), not from the CLI: applying
the permission model, granting `use` on tools, writing explicit blocks,
and setting the observe/enforce posture.

For deeper background on the authentication side of the flow (which
identity is the subject, how the user gate resolves it), see
`/project:ory-auth-setup` and `/project:ory-login-flow`.
