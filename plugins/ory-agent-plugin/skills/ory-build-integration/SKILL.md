---
name: ory-build-integration
description: Wire an Ory Network integration into your own application using the ory/integrates template patterns. Use when the user wants to add an Ory integration to their app — an Action webhook handler that fires during a flow, a Console/gateway config to validate Ory JWTs, or an Enterprise live-event-stream consumer — phrases like "wire up an Ory webhook", "add an Ory Action handler to my app", "react to Ory identity events", "validate Ory tokens at my gateway", "build an Ory integration in my project". For contributing an integration back to ory/integrates instead, use ory-contribute-integration.
---

# Build an Ory Integration Into Your App

You are helping the user wire an Ory Network integration into **their own
application**, reusing the proven patterns from the public `ory/integrates`
repository. There is no contribution, registry, `Maintained by:`, or DCO concern
here — you fetch the **runnable subset** of a template and adapt it in place.

This skill carries the workflow. The template files live in
`github.com/ory/integrates` (branch `main`); fetch the ones you need so they stay
current.

> **Precondition:** `ory/integrates` must be reachable (public repo). If a fetch
> fails, tell the user and stop — do not fabricate handler code.

## Step 1 — Determine the type and app context

Pick the integration type from intent; ask directly if unclear.

| Signal from the user | Type |
|---|---|
| Transform/enrich an identity at registration; gate or react to a flow **synchronously**; call a vendor API during an Ory flow | `webhook` |
| Validate Ory JWTs at a gateway; **Console-only** config; no handler code | `config` |
| React to events **asynchronously**; Ory **Enterprise** Live Event Stream consumer | `http-event` |

Also establish: the app's framework/runtime, where the handler will live, and how
it's deployed (these decide where you write files and how you mount the route).

## Step 2 — Fetch the runnable subset

Pull only the files the user needs from `_examples/_template-<type>/`. Prefer raw
fetch so you don't clone the whole repo into the user's project.

**Raw file fetch** (base URL
`https://raw.githubusercontent.com/ory/integrates/main/_examples/_template-<type>/`):

```bash
BASE=https://raw.githubusercontent.com/ory/integrates/main/_examples/_template-webhook
mkdir -p ory-integration/webhook ory-integration/jsonnet
curl -fsSL "$BASE/ory-actions.yaml"          -o ory-integration/ory-actions.yaml
curl -fsSL "$BASE/jsonnet/identity.jsonnet"  -o ory-integration/jsonnet/identity.jsonnet
curl -fsSL "$BASE/webhook/server.ts"         -o ory-integration/webhook/server.ts
curl -fsSL "$BASE/webhook/package.json"      -o ory-integration/webhook/package.json
curl -fsSL "$BASE/webhook/tsconfig.json"     -o ory-integration/webhook/tsconfig.json
curl -fsSL "$BASE/webhook/.env.example"      -o ory-integration/webhook/.env.example
```

**Sparse checkout** (if the user prefers a git copy to diff against):

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/ory/integrates /tmp/ory-integrates
git -C /tmp/ory-integrates sparse-checkout set _examples/_template-webhook
# then copy the files you want out of /tmp/ory-integrates/_examples/_template-webhook
```

Runnable subset per type (skip `registry.entry.yaml.example`, the
`Maintained by:` README, and lockfiles — `npm install` regenerates the lock):

- **webhook** — `ory-actions.yaml`, `jsonnet/identity.jsonnet`,
  `webhook/{server.ts, package.json, tsconfig.json, .env.example}`.
- **config** — `ory-console-steps.md` (no code; it's a Console walkthrough).
- **http-event** — `ory-event-stream.yaml`,
  `webhook/{server.ts, idempotency.ts, package.json, tsconfig.json, .env.example}`.

Adapt the fetched handler into the user's app: integrate the route into their
existing server if they have one, or run the `webhook/` server standalone.

## Step 3 — Wire it to the user's Ory project

- **webhook** — deploy the handler, then create an Ory Action pointing at it using
  `ory-actions.yaml` as the template (set `url` to the deployed handler, set the
  `X-Webhook-Secret` value, and the matching `ORY_WEBHOOK_SECRET` in the
  handler's `.env`). Adjust `jsonnet/identity.jsonnet` to the body shape the
  handler expects. Apply via the Ory Console or the Ory CLI.
- **config** — follow `ory-console-steps.md`: configure the vendor side, then the
  Ory Console (gateway/JWT validation, provider config, etc.). No code to deploy.
- **http-event** (Enterprise) — deploy the handler, then configure the
  event-stream target from `ory-event-stream.yaml` (URL with embedded Basic Auth;
  set `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` in `.env` to match) and the event
  filter. Keep the `idempotency.ts` dedupe wired up — delivery is at-least-once.

Always verify the signature/secret path: webhook uses the `X-Webhook-Secret`
header; http-event uses HTTP Basic Auth embedded in the configured URL.

## Step 4 — Test locally

Stand up Ory and exercise the flow locally before pointing at production:

- Use `/project:ory-local-dev` to run a local Ory stack (Kratos / Keto / Hydra +
  gateway), then trigger the relevant flow and confirm the handler fires.
- Use `/project:ory-auth-setup` when the app also needs Ory project / SDK setup wired up.

For a webhook, hit `GET /health` on the handler, then run the Ory flow and check
the handler logs. For http-event, emit a test event and confirm both the dedupe
and the downstream side effect.

## What this skill does NOT do

- It does not create a contribution to `ory/integrates` (no `registry.entry.yaml`,
  `Maintained by:`, SPDX, or DCO) — use `ory-contribute-integration` for that.
- It does not invent handler code — it fetches the real templates from
  `ory/integrates`.
- It does not deploy to the user's infrastructure or modify their Ory project
  without confirmation.
