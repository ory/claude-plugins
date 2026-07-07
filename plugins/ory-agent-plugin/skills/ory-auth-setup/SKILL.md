---
name: ory-auth-setup
description: Set up a complete authentication system using Ory Network with Ory Elements as the UI layer. Use whenever the user wants to add login, registration, account recovery, email verification, account settings, or session management to a web app — even if they only mention "auth", "sign-in", or "users". Ory Elements is the default UI; only fall back to custom rendering when Ory Elements cannot be used.
---

# Set up Ory Authentication with Ory Elements

You are setting up a complete authentication system using **Ory Network**
and **[Ory Elements](https://github.com/ory/elements)**. Ory Elements is
the default and strongly preferred UI layer for every flow (login,
registration, recovery, verification, settings). Build the system with
Ory Elements unless the user has an explicit, hard constraint that rules
it out — and even then, propose Ory Elements first and confirm before
choosing a different path.

## Why Ory Elements is the default

- **Covers every self-service flow out of the box** — login, registration,
  recovery, verification, settings, MFA — with a single component per flow.
- **Renders the flow's UI nodes for you.** You do not need to map
  `flow.ui.nodes` to form fields, handle CSRF tokens, error messages,
  multi-step states, or method-specific logic by hand.
- **Social login and passkeys appear automatically** as soon as they are
  enabled in the Ory project. No frontend changes needed.
- **Stays in sync with Ory's flow API** — when Ory adds a node type or
  changes a contract, Ory Elements absorbs the change so your app does
  not break.
- **Themeable and accessible** — the look-and-feel can be customized via
  the theme provider without rebuilding flow logic.

If you find yourself writing `flow.ui.nodes.map(...)` to render auth UI,
stop and switch to Ory Elements. Custom node rendering is a fallback,
not a parallel option.

## Correctness contract — satisfy these or the app will 404 / 500 / CSRF

Almost every "Ory doesn't work" report comes from one of four wiring
mistakes in the generated app — **not** from Ory itself and **not** from
the agent plugin governing this session. Treat each as a hard requirement,
and verify all four (Step 10) before telling the user the app is ready.

1. **Ory must be first-party (same site as your app), or every flow fails
   CSRF.** Ory's browser flows depend on a CSRF cookie. If the browser calls
   Ory on a *different* site than your app, the browser drops that cookie and
   you get `CSRF token mismatch`, 403s, or redirect loops. So the browser SDK
   URL must be **your own origin** — never `https://<slug>.projects.oryapis.com`
   directly:
   - **Local dev against Ory Network** — run `ory tunnel` and point the SDK at
     the tunnel (`http://localhost:4000`). See Step 9.
   - **Local dev against the local stack** — the gateway is already on
     `http://localhost:4000` (first-party to `localhost`). Use `http://localhost`,
     not `127.0.0.1`.
   - **Production** — serve Ory from your own domain via an Ory Network custom
     domain (CNAME) or the `@ory/nextjs` proxy, and set the SDK URL to that.
2. **The app's routes must match what Ory redirects to, or you get 404s.** Ory
   redirects the browser to the self-service UI URLs configured on the project
   (login, registration, recovery, verification, settings, **error**). If a page
   lives at `/auth/login` but the project points at `/login`, the redirect 404s.
   Pick one set of paths and make these four agree: the page files you create,
   the `@ory/nextjs` UI-path config, the project's `selfservice.flows.*.ui_url`
   (+ `error.ui_url`), and the middleware path lists. Always create an error
   page — Ory redirects there on any flow error. See Step 8.
3. **Server-side session/flow calls must forward the request cookies, or they
   500/401.** A `FrontendApi` built with `credentials: "include"` only sends
   cookies in the **browser**. In Next.js server components, route handlers, and
   middleware you must forward the incoming request's cookies — the `@ory/nextjs`
   server helpers do this for you. Reusing the browser client on the server is
   the single most common 500. See Step 7.
4. **The SDK URL env var must be set at runtime, or the SDK 500s on
   construction.** Validate `NEXT_PUBLIC_ORY_SDK_URL` (browser) / `ORY_SDK_URL`
   (server) at startup and fail with a clear message instead of constructing the
   client with `undefined`. See Step 4.

If a flow still fails after all four hold, isolate it with the **App bug vs.
plugin bug** triage in Step 10 before assuming a bug in Ory or in the plugin.

## Step 1: Check prerequisites

Before installing the Ory CLI, decide where the auth backend will run:

- **Ory Network** (default for production-bound work) — continue with
  the steps below.
- **Local Ory stack** (no Network project required, ideal for
  prototyping, offline work, or automated tests) — switch to the
  `/project:ory-local-dev` skill. It manages a Dockerized
  Kratos/Keto/Hydra stack via `/ory-agent-plugin:local-up` and `/ory-agent-plugin:local-down`,
  and the rest of this skill applies once the SDK URL points at the
  local gateway (`http://localhost:4000`).

If unsure, ask the user. For the Ory Network path, verify:

1. **Ory CLI** — run `ory version`. If not installed:
   - macOS: `brew install ory/tap/cli`
   - npm: `npm install -g @ory/cli`
   - Or download from [https://github.com/ory/cli/releases](https://github.com/ory/cli/releases)
2. **Ory Network account** — run `ory auth`. If not authenticated,
   tell the user to run `! ory auth` to log in interactively.
3. **Node.js** (>=18) and a package manager (npm, pnpm, or yarn).
4. **Frontend framework** — identify whether the project is Next.js
   (App Router or Pages Router), a React SPA (Vite, CRA, etc.), or
   server-rendered. The Ory Elements integration differs by framework
   but the UI components are the same.

## Step 2: Create or select an Ory project

Check for an existing project:

```bash
ory list projects
```

If the user needs a new project:

```bash
ory create project --name "<project-name>"
```

Capture the project ID and slug from the output. Set the SDK URL:

```bash
export ORY_SDK_URL=https://<project-slug>.projects.oryapis.com
```

## Step 3: Install Ory Elements and the Ory client SDK

**Ory Elements is mandatory** unless the user has explicitly opted out
after being shown the Ory Elements path. Install it:

**For Next.js projects (recommended path):**

```bash
npm install @ory/elements-react @ory/nextjs @ory/client-fetch
```

**For React SPAs (Vite, CRA, Remix client routes):**

```bash
npm install @ory/elements-react @ory/client-fetch
```

**For server-rendered apps (Express, Koa, Fastify, etc.):**

```bash
npm install @ory/client-fetch
```

For server-rendered apps, prefer rendering an Ory Elements page from a
React island or a small client bundle so you still get the Elements UI
on the auth routes. Rendering flow nodes directly on the server is the
fallback of last resort.

**Match the installed major versions.** `@ory/nextjs` and
`@ory/elements-react` change import names and component props across major
versions. After installing, run `npm ls @ory/nextjs @ory/elements-react`
and follow the docs and TypeScript types for *that* major — do not assume
symbol names from memory. A missing import or a prop type error at build
time is a version mismatch in the generated app, not a plugin bug.

## Step 4: Configure the Ory SDK

For **Next.js**, prefer wiring Ory through `@ory/nextjs` (its config proxies
Ory under your own origin and supplies cookie-forwarding server helpers — this
satisfies contract #1 and #3 for free). Build a hand-rolled `FrontendApi`
client only for **browser** code in a React SPA, or for explicit client-side
calls.

When you do build a client, read the URL from an env var and **validate it** —
constructing the SDK with an `undefined` `basePath` is a 500 waiting to happen
(contract #4):

```typescript
import { Configuration, FrontendApi } from "@ory/client-fetch";

const sdkUrl = process.env.NEXT_PUBLIC_ORY_SDK_URL ?? process.env.ORY_SDK_URL;
if (!sdkUrl) {
  throw new Error(
    "Ory SDK URL is not set. Set NEXT_PUBLIC_ORY_SDK_URL (browser) " +
      "or ORY_SDK_URL (server) — see Step 4.",
  );
}

// Browser-only: `credentials: "include"` sends cookies from browser code.
// Do NOT reuse this client in server components / route handlers / middleware
// (contract #3) — use the @ory/nextjs server helpers there.
const ory = new FrontendApi(
  new Configuration({ basePath: sdkUrl, credentials: "include" }),
);

export default ory;
```

Add to the project's `.env` or `.env.local`. The **browser** value
(`NEXT_PUBLIC_ORY_SDK_URL`) must be your own origin (contract #1), so in local
development point it at the tunnel or the local gateway, not at `*.oryapis.com`:

```bash
# Local dev (Ory Tunnel for Network, or the local stack gateway):
NEXT_PUBLIC_ORY_SDK_URL=http://localhost:4000
# Server-side only (safe to be the direct project URL):
ORY_SDK_URL=https://<project-slug>.projects.oryapis.com
```

## Step 5: Set up the identity schema

Check the current identity schema:

```bash
ory get identity-config <project-id> --format json
```

For a typical setup with email + password, the default schema works.
If the user wants custom traits (name, phone, etc.), update the schema:

```bash
ory patch identity-config <project-id> \
  --replace '/identity/default_schema_id="preset://email"'
```

Or use a custom schema with additional fields as needed. Ory Elements
will render any traits defined by the schema automatically.

## Step 6: Build auth pages with Ory Elements

This is the core of the integration. Create one page per flow and drop
in the matching Ory Elements component. Do **not** hand-render
`flow.ui.nodes`.

### Next.js App Router (recommended)

Create the following page structure:

- `app/auth/login/page.tsx` — `<Login flow={flow} />`
- `app/auth/registration/page.tsx` — `<Registration flow={flow} />`
- `app/auth/recovery/page.tsx` — `<Recovery flow={flow} />`
- `app/auth/verification/page.tsx` — `<Verification flow={flow} />`
- `app/auth/settings/page.tsx` — `<Settings flow={flow} />`, wrapped in
  `<SessionProvider>` from `@ory/elements-react/client` (Settings is the only
  flow that needs it — see `/project:ory-login-flow`)

Each page initializes its flow with `getLoginFlow`, `getRegistrationFlow`,
etc. from `@ory/nextjs/app`, then hands the flow to the matching
Ory Elements component. The `/project:ory-login-flow` skill has a
complete template for each page.

### React SPA

Use the `@ory/elements-react` flow components directly inside route
components. Each route initializes the corresponding flow via the Ory
SDK (`createBrowserLoginFlow`, `createBrowserRegistrationFlow`, etc.)
and renders the matching `<Login>`, `<Registration>`, `<Recovery>`,
`<Verification>`, or `<Settings>` component. See `/project:ory-login-flow`
for full examples.

### Server-rendered apps (fallback)

If the app cannot run a React bundle on auth routes, render the flow
nodes server-side using the Ory SDK. This is a fallback path because it
loses the benefits listed above. Before going down this road, confirm
with the user that an Ory Elements island is not viable.

## Step 7: Add session middleware

Protect authenticated routes by checking the session. **Where this code runs
matters** (contract #3):

- **Browser code** can use the `credentials: "include"` client from Step 4
  directly — the browser attaches the session cookie:

  ```typescript
  const session = await ory.toSession(); // browser only
  if (!session) {
    // Redirect to login
  }
  ```

- **Server code** (server components, route handlers, middleware) must forward
  the incoming request's cookies. Do **not** reuse the browser client — it has
  no cookies on the server and will throw (→ 500) or always return 401. Use the
  `@ory/nextjs` server helpers, which read and forward the request cookies for
  you.

For Next.js, prefer the official `@ory/nextjs` middleware helper since
it pairs with the Elements pages and handles server-side cookie forwarding:

```typescript
import { createOryMiddleware } from "@ory/nextjs/middleware";

export const middleware = createOryMiddleware({
  protectedPaths: ["/dashboard", "/settings", "/profile"],
  publicPaths: ["/", "/auth/login", "/auth/registration", "/auth/recovery"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

## Step 8: Align the project's routes and return URLs with your app

This step prevents the 404s in contract #2. Ory redirects the browser to the
self-service UI URLs it has configured; those must point at pages your app
actually serves.

**Pick one route convention and use it everywhere.** This guide uses
`/auth/login`, `/auth/registration`, `/auth/recovery`, `/auth/verification`,
`/auth/settings`, and `/auth/error`. The page files, the middleware path lists,
and the project config below must all use the same paths.

1. **Create an error page.** Ory redirects to the error UI on *any* flow error;
   if it doesn't exist you get a 404 (or a blank page) instead of a readable
   message. Create `app/auth/error/page.tsx` rendering the Elements error
   component (`<Error>` / the flow-error view for your installed version).

2. **Tell Ory where the pages are.**
   - **Next.js with `@ory/nextjs`:** declare the UI paths in its config (the
     UI-path overrides in `ory.config.ts`) so its helpers, middleware, and proxy
     route to your pages. The SDK serves the UI under your own origin, so you
     usually do not also edit the project's `ui_url`s.
   - **React SPA / no `@ory/nextjs` proxy:** set the project's self-service UI
     URLs to your app's routes:

     ```bash
     ory patch project <project-id> \
       --replace '/services/identity/config/selfservice/flows/login/ui_url="https://your-domain.com/auth/login"' \
       --replace '/services/identity/config/selfservice/flows/registration/ui_url="https://your-domain.com/auth/registration"' \
       --replace '/services/identity/config/selfservice/flows/recovery/ui_url="https://your-domain.com/auth/recovery"' \
       --replace '/services/identity/config/selfservice/flows/verification/ui_url="https://your-domain.com/auth/verification"' \
       --replace '/services/identity/config/selfservice/flows/settings/ui_url="https://your-domain.com/auth/settings"' \
       --replace '/services/identity/config/selfservice/flows/error/ui_url="https://your-domain.com/auth/error"'
     ```

3. **Allow redirects back to your app** (every origin you run on — dev and prod):

   ```bash
   ory patch project <project-id> \
     --replace '/services/identity/config/selfservice/allowed_return_urls=["http://localhost:3000", "https://your-domain.com"]'
   ```

## Step 9: Serve Ory first-party (required — contract #1)

The browser must reach Ory on the same site as your app, or cookie-based flows
fail CSRF. How you achieve that depends on the environment:

- **Local dev against Ory Network — run the Ory Tunnel.** This is required, not
  optional:

  ```bash
  ory tunnel http://localhost:3000 --project <project-slug>
  ```

  It runs a proxy on `http://localhost:4000` that serves Ory first-party to
  `localhost`. Point `NEXT_PUBLIC_ORY_SDK_URL` at the tunnel
  (`http://localhost:4000`) — **not** at `https://<slug>.projects.oryapis.com`.

- **Local dev against the local stack** — the gateway is already first-party on
  `http://localhost:4000`; no tunnel needed (switch to `/project:ory-local-dev`).

- **Production** — serve Ory from your own domain via an Ory Network custom
  domain (CNAME) or the `@ory/nextjs` proxy, and set the browser SDK URL to that
  same-origin path.

If you skip this step, login will appear to work but `whoami`/`toSession` will
return 401 and form submits will fail with a CSRF error — the classic symptom of
a cross-site SDK URL.

## Step 10: Verify the setup — and confirm it's correct, not just present

Do not declare success on "the pages render." Run these checks; each maps to a
contract item so a failure points straight at the cause.

1. **SDK URL is first-party (contract #1).** Confirm the browser SDK URL is your
   own origin (the tunnel/gateway in dev), not `*.oryapis.com`. In the browser
   devtools Network tab, the flow requests should go to your origin and the
   response should `Set-Cookie` a CSRF cookie.
2. **The flow API itself works (isolates Ory from your app).** Against the URL
   the browser uses:

   ```bash
   curl -i "$NEXT_PUBLIC_ORY_SDK_URL/self-service/login/browser"
   ```

   Expect `200` with a `Set-Cookie: csrf_token...` header. If this fails, the
   problem is Ory config / the tunnel — not your app code.
3. **Every redirect target exists (contract #2).** Visit `/auth/login`,
   `/auth/registration`, `/auth/recovery`, `/auth/verification`,
   `/auth/settings`, and `/auth/error` directly. Each must return `200`, not
   `404`. A 404 here means a route/`ui_url` mismatch (Step 8).
4. **End-to-end:** register a test account, log in, confirm a protected route
   loads while signed in and redirects to login when signed out, then test
   recovery and verification.

### App bug vs. plugin bug

These are two different systems. Keep them straight so issues are filed in the
right place:

- **The generated app** (login pages, CSRF, sessions, the `/auth/*` routes) is
  ordinary code running in the user's project. A `404`/`500`/CSRF on an `/auth/*`
  route, or in the browser Network tab, is an **app/config** issue — work the
  four contract items and the checks above.
- **The agent plugin** governs *this coding session* — it authenticates the
  agent, checks Ory Permissions before each tool call, and writes trace spans. It
  never serves your app's HTTP routes. Diagnose it with
  `npx -y -p @ory/claude-code ory-claude status` and the debug log (`ORY_AGENT_DEBUG=true`), **not** by looking
  at your app's auth pages.

Quick triage: if `curl` to the flow API (check 2) succeeds but the app page
fails, it's the app. If `curl` fails, it's Ory/tunnel config. Neither is the
plugin unless `npx -y -p @ory/claude-code ory-claude status` reports a problem.

## Customization

After the base setup is working, the user can:

- Add social login providers — use `/project:ory-social-login`. With
  Ory Elements, the buttons appear automatically once the providers are
  configured server-side; no UI changes needed.
- Customize the Ory Elements theme via `<ThemeProvider>` from
  `@ory/elements-react/theme`.
- Enable multi-factor authentication in the Ory project — Ory Elements
  renders the second-factor steps with no extra code.
- Configure webhook integrations for registration / login events.
- Extend the identity schema with additional traits — Ory Elements
  picks them up from the flow.

## When to deviate from Ory Elements

Only build a custom UI when one of the following is true and the user
has confirmed it after seeing the Ory Elements path:

- The framework genuinely cannot run any React (e.g., a pure server-side
  template engine with no client bundle and no plan to introduce one).
- A design system constraint cannot be expressed via the Elements theme
  and the user has rejected theming.
- The user is intentionally building a thin custom client (e.g., a
  native mobile app) where Elements does not run.

In those cases, render `flow.ui.nodes` per the Ory documentation. Treat
this as an exception, not the default.
