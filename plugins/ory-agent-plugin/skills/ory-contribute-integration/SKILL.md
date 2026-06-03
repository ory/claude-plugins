---
name: ory-contribute-integration
description: Author a new Ory Network integration as a contribution to the public ory/integrates repository. Use when the user wants to contribute an integration back to Ory, add an entry to the Ory integrations registry/catalog, open a PR against ory/integrates, or publish a reusable integration for others — phrases like "contribute an Ory integration", "add my integration to ory/integrates", "submit a webhook integration to Ory", "get my integration into the registry". For wiring an integration into your own app instead, use ory-build-integration.
---

# Contribute an Integration to ory/integrates

You are helping the user author a new integration and contribute it back to the
public `ory/integrates` repository ("Sample code and reference configuration for
integrating Ory Network with third-party products"). The deliverable is a pull
request against `github.com/ory/integrates`.

This skill carries the workflow. The **template files** live in the repo itself —
fetch them from `github.com/ory/integrates` (branch `main`) rather than
reproducing them, so they never drift.

> **Precondition:** `ory/integrates` must be reachable (it is a public repo). If
> `gh repo view ory/integrates` or a fetch of a template file fails, tell the
> user the repo is unreachable and stop — do not fabricate template contents.

## Step 0 — Open the "New integration" issue first

Ory asks contributors to open a **New integration** issue before the PR, so scope
is confirmed and the work isn't already in flight. Remind the user to do this
(GitHub → `ory/integrates` → Issues → "New integration" template) and capture the
issue number for the PR.

## Step 1 — Get a checkout and pick the category

The contribution workflow happens inside a checkout of the repo:

```bash
gh repo clone ory/integrates
cd integrates
```

(or a fork, if the user will PR from their own remote.) Then choose the
**category folder** the integration belongs in — it must match an existing
top-level directory (`crm/`, `api-gateways/`, `identity-verification/`, `mfa/`,
`enterprise-sso/`, …). List them with `ls -d */ | grep -v _examples`.

## Step 2 — Determine the integration type

Every integration is one of three types. Infer from intent; if unclear, ask
directly.

| Signal from the user | Type | Template |
|---|---|---|
| Transform/enrich an identity at registration; gate or react to a self-service flow **synchronously**; call a vendor API during an Ory flow | `webhook` | `_examples/_template-webhook/` |
| Validate Ory JWTs at a gateway; **Console-only** setup; no handler code | `config` | `_examples/_template-config/` |
| React to events **asynchronously**; Ory Network **Enterprise** Live Event Stream consumer | `http-event` | `_examples/_template-http-event/` |

## Step 3 — Copy the template into the category folder

From the repo root, copy the whole template directory to
`<category>/<integration-slug>` (slug is lowercase, hyphenated, matches the dir
name):

```bash
cp -R _examples/_template-webhook crm/<integration-slug>      # webhook
# or _examples/_template-config / _examples/_template-http-event
```

Each template ships these files (confirm with `ls -R <category>/<integration-slug>`):

- **webhook** — `README.md`, `ory-actions.yaml`, `jsonnet/identity.jsonnet`,
  `registry.entry.yaml.example`, and a runnable `webhook/` (`server.ts`,
  `package.json`, `package-lock.json`, `tsconfig.json`, `.env.example`).
- **config** — `README.md`, `ory-console-steps.md`,
  `registry.entry.yaml.example`.
- **http-event** — `README.md`, `ory-event-stream.yaml`,
  `registry.entry.yaml.example`, and a runnable `webhook/` (`server.ts`,
  `idempotency.ts`, `package.json`, `package-lock.json`, `tsconfig.json`,
  `.env.example`).

The copied files are the source of truth — read them and fill in every
`<placeholder>` and `<!-- comment -->`.

## Step 4 — Fill out the integration

1. **README.md** — replace `<Integration Name>`, set the `Maintained by:` line
   (`Ory Engineering`, `Community contributors`, or the user's `@handle`), and
   complete: what it does, use case, prerequisites, deploy steps, **Ory Console
   configuration**, troubleshooting. No vendor marketing — factual wiring only.
2. **Code / config for the type** (see per-type notes below).
3. **registry.entry.yaml** — rename `registry.entry.yaml.example` →
   `registry.entry.yaml` and fill in every field (`name`, `displayName`,
   `vendor`, `category`, `type`, `maintainedBy`, `description`, `useCase`,
   `coreFunctionality`, `oryMechanism`, `protocol`, `status`; http-event also
   needs `subscribedEvents`). The field comments in the file enumerate the
   allowed enum values.
4. **Apache-2.0 SPDX header** at the top of every source file you ship, e.g.
   `// SPDX-License-Identifier: Apache-2.0`.

### webhook specifics
- `ory-actions.yaml` is the Ory Action hook config (a `web_hook` with an
  `X-Webhook-Secret` `api_key` auth header). Point `url` at the deployed handler
  and set the shared secret.
- `jsonnet/identity.jsonnet` is the request-body template — adjust to the shape
  your handler expects.
- The `webhook/` server must run (`cd webhook && cp .env.example .env && npm
  install && npm start`); it exposes `GET /health` and the `POST` target.
  `ORY_WEBHOOK_SECRET` in `.env` must match the secret in `ory-actions.yaml`.

### config specifics
- No code. Write a real `ory-console-steps.md`: vendor-side setup, the exact Ory
  Console navigation, the fields to configure, a test, and troubleshooting. A
  README-only contribution with no real console steps will be rejected.

### http-event specifics
- `ory-event-stream.yaml` configures the Ory-side event target (URL with embedded
  Basic Auth) and the event filter. List the consumed events under both the YAML
  `events:` and the registry `subscribedEvents:`.
- The `webhook/` handler authenticates with HTTP Basic Auth, dedupes by SHA-256
  of the body (`idempotency.ts`) because delivery is at-least-once, and always
  returns 200. Live event streams are an **Enterprise** feature — say so in the
  README.

## Step 5 — Regenerate the registry

From the repo root:

```bash
cd scripts && npm install && cd ..
node scripts/build-registry.js
```

This rewrites the top-level `registry.yaml` from every `registry.entry.yaml`.
Commit the regenerated `registry.yaml` along with your integration.

## Step 6 — Open the PR (DCO + checklist)

Walk the CONTRIBUTING checklist before opening the PR:

- [ ] Integration is in the correct category folder.
- [ ] `README.md` covers what it does, prerequisites, deploy, Console config,
      troubleshooting, and a `Maintained by:` line.
- [ ] Type deliverables present: webhook → `ory-actions.yaml` + `jsonnet/` +
      runnable `webhook/`; config → real `ory-console-steps.md`; http-event →
      `ory-event-stream.yaml` + runnable `webhook/` + `subscribedEvents`.
- [ ] `registry.entry.yaml` filled and `registry.yaml` regenerated.
- [ ] Apache-2.0 SPDX header in each source file.
- [ ] **DCO sign-off on every commit** — `git commit -s`.

```bash
git checkout -b add-<integration-slug>-integration
git add <category>/<integration-slug> registry.yaml
git commit -s -m "Add <Integration Name> integration"
git push -u origin add-<integration-slug>-integration
gh pr create --repo ory/integrates --title "Add <Integration Name> integration" \
  --body "Closes #<issue-number>. <summary>"
```

Expect review questions about Ory Network compatibility, webhook security
(signature verification, secret handling), and README clarity.

## What this skill does NOT do

- It does not wire an integration into the user's own application — use
  `ory-build-integration` for that (no registry/DCO).
- It does not run `build-registry.js` or open the PR without confirmation; it
  guides, the user executes.
- It does not invent template contents — it reads the real files from
  `ory/integrates`.
