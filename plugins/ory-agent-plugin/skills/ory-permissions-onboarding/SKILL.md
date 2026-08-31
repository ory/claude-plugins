---
name: ory-permissions-onboarding
description: Onboard native agent-tool authorization with default allow and explicit deny overrides. Covers connecting the plugin, reviewing allowed and blocked tools, writing blocks in the Ory Console, and promoting the project from observe to enforce. MCP and PermissionMode remain grant-based.
---

# Onboard Ory Permissions for Agent Tool Calls

Help the user connect Agent Security and roll out explicit native-tool blocks
without treating missing grants as denials.

**The plugin only reads permissions. It never writes them.** The permission
model, native-tool blocks, MCP grants, and observe/enforce posture are managed
in the **Ory Console** (Agent Security).

Native policy is simple:

- `AgentTool` and `ShellTool` have no `users` relation.
- Their `use` permit is `!blockedSubjects.includes(subject)`.
- No matching block means allowed; a matching block means denied.
- `observe` logs the block and proceeds; `enforce` vetoes the call.
- MCP permissions and `PermissionMode#enforcedSubjects` remain grant-based.

## 1. Connect Agent Security

Copy the connection details shown in the Ory Console under **Agent Security**:

```sh
npx -y -p @ory/claude-code ory-claude configure --project-url <URL> --agent-security-url <URL>
```

Then inspect the resolved configuration:

```sh
npx -y -p @ory/claude-code ory-claude status
```

Confirm that Agent Security is connected and the public OAuth2 login client is
resolved. The plugin needs no workspace privilege or project API key.

## 2. Review Native Tool Access

```sh
npx -y -p @ory/claude-code ory-claude permissions
```

The report shows:

- The live permission mode and its source.
- The user subject being checked.
- Each built-in native tool as `allowed`, `blocked`, or `errored`.
- A compact allowed/blocked summary for decomposed shell command words.

A fresh project normally reports native tools as **allowed**. There is no grant
coverage step and the local seed writes no baseline `AgentTool` or `ShellTool`
grants.

## 3. Add Explicit Blocks in the Console

To block a native tool, write a `blockedSubjects` relation in the Ory Console:

```text
namespace: AgentTool
object:    <tool name>          e.g. WebFetch
relation:  blockedSubjects
subject:   User:<id>
```

To block a command word reached through a shell tool:

```text
namespace: ShellTool
object:    <command word>       e.g. curl
relation:  blockedSubjects
subject:   User:<id>
```

Blocks can also target the project, an agent credential, an agent session, a
sub-agent credential, or a sub-agent spawn. Group/SubjectSet expansion is
supported. A native deny is always an explicit block, never a missing grant.

MCP is intentionally different: continue granting MCP server/tool access with
its existing `users`/`use` and `invoke` relations.

## 4. Observe Before Enforcing

While the project is in `observe`, run normal sessions and inspect:

```sh
npx -y -p @ory/claude-code ory-claude permissions
npx -y -p @ory/claude-code ory-claude watch
```

Matching blocks emit `permission.block_observed` but the tool still runs. Review
those events, then promote the project or selected principals to `enforce` in
the Ory Console. Every gate reads the project-controlled posture.

## 5. Verify Enforcement

Under `enforce`:

- Tools without a matching block run normally.
- Explicitly blocked tools produce a clear "explicitly blocked" message.
- A blocked `ShellTool` word blocks the outer shell command and names the word.
- Infrastructure failures retain the core fail-open behavior.

If a tool is unexpectedly blocked, use `npx -y -p @ory/claude-code ory-claude permissions` to identify the
block and remove or narrow its `blockedSubjects` relation in the Console.

## Reference

| Command | Effect |
|---|---|
| `npx -y -p @ory/claude-code ory-claude configure --project-url <URL> --agent-security-url <URL>` | Connect Agent Security. |
| `npx -y -p @ory/claude-code ory-claude configure --disconnect` | Disconnect sign-in and permission checks. |
| `npx -y -p @ory/claude-code ory-claude permissions` | Print live mode plus native allowed/blocked state. Read-only. |
| `npx -y -p @ory/claude-code ory-claude status` | Print configuration, identities, native tool access, and recent activity. |

For authentication and subject-resolution details, see `/project:ory-auth-setup` and
`/project:ory-login-flow`.
