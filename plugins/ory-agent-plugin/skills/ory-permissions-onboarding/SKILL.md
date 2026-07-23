---
name: ory-permissions-onboarding
description: Onboard a fresh install onto Ory Permissions for AI agent tool calls. Use when the user has just installed the Ory plugin and wants to enforce per-tool authorization without first getting blocked by missing tuples. Walks through observe-mode observation, idempotent tuple bootstrap, and promotion to enforce mode.
---

# Onboard onto Ory Permissions for Agent Tool Calls

You are helping a user move a freshly-installed Ory agent plugin from
"permissions are running but never block" (the default after install)
to "permissions are enforcing" (the production posture), without the
common first-run failure mode of getting every tool call blocked
because no tuples exist yet.

The plugin ships with two orthogonal switches:

- **`auditOnly`** — a kill switch. When set, Ory is *off entirely* (no
  auth, no permission checks). This is for users who want only audit
  logging of tool invocations. Not what onboarding is about.
- **`permissionMode`** — the dial this skill is about. `observe` (the
  default) runs every permission check, logs denials, but allows the
  tool to proceed. `enforce` blocks on deny. Mode is read from
  `ORY_PERMISSION_MODE` first, then the shared config file, then
  defaults to `observe`.

The journey: **install → observe → bootstrap → enforce.**

## Step 1: Confirm the plugin is installed and configured

Verify the plugin is wired up and pointing at the right Ory project:

```sh
npx -y -p @ory/claude-code ory-claude status
```

What you want to see:

- **Project URL**: a real Ory URL or your local dev gateway (not "NOT SET").
- **API Key**: set (Ory Network) or unset (local Keto OSS — that's fine).
- **Mode**: not "audit-only" — that would mean Ory is disabled.

If any of those are wrong, fix them before continuing:

```sh
npx -y -p @ory/claude-code ory-claude configure --project-url <URL> --oauth2-client-id <CLIENT_ID> [--api-key <KEY>]
```

`--oauth2-client-id` is the public OAuth2 client registered in your Ory project (needed for the per-session user login to complete its PKCE browser flow; see the *Register the user OAuth2 client* section of the plugin README).

## Step 2: Look at the current permission posture

```sh
npx -y -p @ory/claude-code ory-claude permissions status
```

This prints:

- The current **permission mode** (`observe` or `enforce`) and where it
  was resolved from (env / config / default).
- The **subject** (the user identity tuples are checked against).
- For each tool in this harness's built-in catalog, **allowed / denied /
  errored** based on a real `checkPermission` call against your Ory
  project right now.

On a fresh install you will almost always see every tool reported as
**denied** — because no tuples exist yet for the current user. That's
expected, and in observe mode it is *not blocking anyone*. The tool
calls are running through; you are simply seeing what *would* be
blocked once enforce mode is turned on.

If the status command prints `Mode: enforce` but tuples are missing,
stop here: tool calls *are* being blocked right now. Either bootstrap
(next step) or run `npx -y -p @ory/claude-code ory-claude permissions observe` first to flip back to
non-blocking.

## Step 3: Bootstrap tuples for the harness's built-in tools

Grant the current user `use` on every tool the harness ships with:

```sh
npx -y -p @ory/claude-code ory-claude permissions bootstrap
```

This is **idempotent** — Keto returns 409 on a tuple that already
exists, and the command treats that as success. Safe to re-run any time
(e.g. after the harness adds a new tool to its catalog).

The command writes `<namespace>:<tool>#use@<userSubject>` for each tool
in the harness's known catalog. MCP server tools are *not* covered —
they are discovered dynamically per session, so they need tuples added
out-of-band as they come into scope.

### When bootstrap can't write tuples

Two common failure modes:

1. **No user identity cached.** Bootstrap needs to know which subject
   to grant tuples to. If the user login has never completed (no PKCE login,
   no `ORY_USER_SUBJECT_ID`), the command refuses. Run the harness once
   (the user login runs every session) to cache a user token, or set
   `ORY_USER_SUBJECT_ID=<id>` to target a known subject.
2. **Credentials lack write scope on the permission namespace.** The
   command prints the full tuple list so you can apply them manually
   via `keto relation-tuples create`, the Ory Console's *Add
   relationship* dialog, or `curl` against Keto's write API. Hand the
   list to whoever holds write credentials.

### Add tuples for non-default tools

If the harness has tools beyond the built-in catalog (MCP servers,
custom commands), grant them by writing tuples directly. Use the same
shape:

```
namespace: AgentTools           (or whatever ORY_PERMISSION_NAMESPACE is set to)
object:    <tool name>
relation:  use
subject:   <user subject id>
```

Re-run `npx -y -p @ory/claude-code ory-claude permissions status` afterwards to confirm coverage.

## Step 4: Promote to enforce mode

Once `permissions status` shows the tools you actually use are
`allowed`, flip the dial:

```sh
npx -y -p @ory/claude-code ory-claude permissions enforce
```

This persists `permissionMode = "enforce"` in the shared config file.
Subsequent sessions will block any tool call that returns deny. Mode
can always be flipped back:

```sh
npx -y -p @ory/claude-code ory-claude permissions observe
```

`ORY_PERMISSION_MODE`, when set, overrides the config — useful for CI
runs that want enforce regardless of what's persisted, or for one-off
debugging sessions where you want observe without rewriting config.

## Step 5: Verify a real session

Start a normal agent session and confirm:

- **Allowed tools** invoke without complaint.
- **Denied tools** (if any) are blocked with a clear "Ory: permission
  denied" message.
- The trace file shows `permission.check` spans for each tool call and
  `tool.block` spans for any denial.

If a tool is unexpectedly blocked, run `npx -y -p @ory/claude-code ory-claude permissions status` to
confirm whether the tuple exists, then add or fix tuples and re-test.

## Reference: what each command does

| Command | Effect |
|---|---|
| `npx -y -p @ory/claude-code ory-claude permissions status` | Print mode + per-tool allow/deny breakdown for the current user. Read-only. |
| `npx -y -p @ory/claude-code ory-claude permissions bootstrap` | Write `use` tuples for the harness's built-in tools. Idempotent. |
| `npx -y -p @ory/claude-code ory-claude permissions bootstrap --dry-run` | Print what would be written without making any changes. |
| `npx -y -p @ory/claude-code ory-claude permissions observe` | Persist `permissionMode = "observe"` (denies log, allow through). |
| `npx -y -p @ory/claude-code ory-claude permissions enforce` | Persist `permissionMode = "enforce"` (denies block). |

For deeper background on the authentication side of the flow (which
identity is the subject, how the user gate resolves it), see
`/project:ory-auth-setup` and `/project:ory-login-flow`.
