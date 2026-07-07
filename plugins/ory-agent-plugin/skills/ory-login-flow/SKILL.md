---
name: ory-login-flow
description: Build login, registration, account recovery, email verification, and account settings pages using Ory Elements. Use whenever the user asks for a login page, sign-in UI, sign-up form, "forgot password" flow, account settings page, or wants to wire Ory's self-service flows into a frontend. Ory Elements is the default rendering layer; only fall back to custom UI nodes if Elements cannot run in the target environment.
---

# Build Auth Pages with Ory Elements

You are building login, registration, recovery, verification, and
settings pages using **[Ory Elements](https://github.com/ory/elements)**
— a prebuilt UI component library that renders Ory's self-service flows.

**Default rule: every page in this guide is rendered with Ory Elements.**
Do not hand-roll forms from `flow.ui.nodes` unless the user has
explicitly opted out after seeing the Ory Elements path. Custom node
rendering belongs in the fallback section at the end of this skill.

## Why Ory Elements

- One component per flow (`<Login>`, `<Registration>`, `<Recovery>`,
  `<Verification>`, `<Settings>`) covers the entire self-service surface.
- Handles CSRF tokens, error messages, multi-step states, social
  buttons, passkeys, and MFA prompts automatically.
- New node types and flow capabilities ship with Elements upgrades —
  no per-app rewrite needed.
- Works in Next.js (App Router and Pages Router) and any React SPA.

## Avoid the 404 / 500 / CSRF traps

These pages only work if the surrounding wiring is correct — most "the login
page is broken" reports are wiring, not the pages or the plugin. If you have not
run `/project:ory-auth-setup`, do that first; it establishes the four invariants these
pages depend on:

- **First-party SDK URL** — the browser must reach Ory on your own origin (the
  Ory Tunnel or local gateway, `http://localhost:4000` in dev), never
  `https://<slug>.projects.oryapis.com` directly, or every form submit fails
  with a CSRF error.
- **Routes match the project config** — the `/auth/*` paths below must match the
  project's self-service `ui_url`s and the middleware lists, and you must create
  an `/auth/error` page, or Ory's redirects 404.
- **Server calls forward cookies** — server-side session/flow reads must forward
  the request cookies (the `@ory/nextjs` server helpers do this); reusing the
  browser client on the server 500s.

See the **Correctness contract** and the **App bug vs. plugin bug** triage in
`/project:ory-auth-setup` for the full detail.

## Before you start

Check the project setup:

1. Identify the framework: Next.js (App Router preferred), React SPA
   (Vite, CRA, Remix client routes), Vue, or server-rendered. Vue and
   server-rendered apps drop into the fallback path below.
2. Verify Ory Elements and the SDK are installed. If not:

   For Next.js:

   ```bash
   npm install @ory/elements-react @ory/nextjs @ory/client-fetch
   ```

   For React SPAs:

   ```bash
   npm install @ory/elements-react @ory/client-fetch
   ```

3. Verify `ORY_SDK_URL` or `NEXT_PUBLIC_ORY_SDK_URL` is configured in
   the environment.

If Ory is not set up at all, suggest the user run
`/project:ory-auth-setup` first.

## Understand Ory self-service flows

Ory uses a **self-service flow** model. Each auth action
(login, registration, recovery, verification, settings) is a "flow"
with these stages:

1. **Initialize** — call the Ory API to create a flow (returns a flow
   object with UI nodes).
2. **Render** — display the form. **Ory Elements does this for you.**
3. **Submit** — post the user's input back to Ory. Ory Elements wires
   the form action; in the SPA flow you call
   `updateLoginFlow` / `updateRegistrationFlow` / etc.
4. **Handle result** — redirect on success, show errors on failure.
   Ory Elements surfaces errors in-form automatically.

## Build the login page

### Login — Next.js App Router (preferred)

Create `app/auth/login/page.tsx`:

```typescript
import { Login } from "@ory/elements-react/theme"
import { getLoginFlow, OryPageLayout } from "@ory/nextjs/app"

export default async function LoginPage(props: {
  searchParams: Promise<{ flow?: string; return_to?: string }>
}) {
  const searchParams = await props.searchParams
  const flow = await getLoginFlow(searchParams)

  if (!flow) {
    return null
  }

  return (
    <OryPageLayout>
      <Login flow={flow} />
    </OryPageLayout>
  )
}
```

### Login — React SPA

Use the same `<Login>` component from `@ory/elements-react/theme`.
Initialize the flow via the SDK and pass it in:

```typescript
import { useEffect, useState } from "react";
import { FrontendApi, Configuration, LoginFlow } from "@ory/client-fetch";
import { Login } from "@ory/elements-react/theme";
import "@ory/elements-react/theme/styles.css";

const ory = new FrontendApi(
  new Configuration({
    basePath: import.meta.env.VITE_ORY_SDK_URL,
    credentials: "include",
  })
);

export function LoginPage() {
  const [flow, setFlow] = useState<LoginFlow | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flowId = params.get("flow");

    const load = flowId
      ? ory.getLoginFlow({ id: flowId })
      : ory.createBrowserLoginFlow();

    load.then(setFlow).catch(console.error);
  }, []);

  if (!flow) return <div>Loading…</div>;

  return <Login flow={flow} />;
}
```

`<Login>` handles CSRF, error rendering, social buttons, passkeys,
and submission for you. Do not unwrap `flow.ui.nodes` here.

## Build the registration page

### Registration — Next.js App Router

Create `app/auth/registration/page.tsx`:

```typescript
import { Registration } from "@ory/elements-react/theme"
import { getRegistrationFlow, OryPageLayout } from "@ory/nextjs/app"

export default async function RegistrationPage(props: {
  searchParams: Promise<{ flow?: string; return_to?: string }>
}) {
  const searchParams = await props.searchParams
  const flow = await getRegistrationFlow(searchParams)

  if (!flow) {
    return null
  }

  return (
    <OryPageLayout>
      <Registration flow={flow} />
    </OryPageLayout>
  )
}
```

### Registration — React SPA

Mirror the login pattern: initialize with `createBrowserRegistrationFlow`
(or `getRegistrationFlow` when a `flow` query param is present) and
render `<Registration flow={flow} />` from `@ory/elements-react/theme`.

## Build the account recovery page

### Recovery — Next.js App Router

Create `app/auth/recovery/page.tsx`:

```typescript
import { Recovery } from "@ory/elements-react/theme"
import { getRecoveryFlow, OryPageLayout } from "@ory/nextjs/app"

export default async function RecoveryPage(props: {
  searchParams: Promise<{ flow?: string }>
}) {
  const searchParams = await props.searchParams
  const flow = await getRecoveryFlow(searchParams)

  if (!flow) {
    return null
  }

  return (
    <OryPageLayout>
      <Recovery flow={flow} />
    </OryPageLayout>
  )
}
```

### Recovery — React SPA

Initialize with `createBrowserRecoveryFlow` and render
`<Recovery flow={flow} />` from `@ory/elements-react/theme`.

## Build the verification page

### Verification — Next.js App Router

Create `app/auth/verification/page.tsx`:

```typescript
import { Verification } from "@ory/elements-react/theme"
import { getVerificationFlow, OryPageLayout } from "@ory/nextjs/app"

export default async function VerificationPage(props: {
  searchParams: Promise<{ flow?: string }>
}) {
  const searchParams = await props.searchParams
  const flow = await getVerificationFlow(searchParams)

  if (!flow) {
    return null
  }

  return (
    <OryPageLayout>
      <Verification flow={flow} />
    </OryPageLayout>
  )
}
```

### Verification — React SPA

Initialize with `createBrowserVerificationFlow` and render
`<Verification flow={flow} />` from `@ory/elements-react/theme`.

## Build the account settings page

### Settings — Next.js App Router

Create `app/auth/settings/page.tsx`:

```typescript
import { Settings } from "@ory/elements-react/theme"
import { SessionProvider } from "@ory/elements-react/client"
import { getSettingsFlow, OryPageLayout } from "@ory/nextjs/app"

export default async function SettingsPage(props: {
  searchParams: Promise<{ flow?: string }>
}) {
  const searchParams = await props.searchParams
  const flow = await getSettingsFlow(searchParams)

  if (!flow) {
    return null
  }

  return (
    <OryPageLayout>
      <SessionProvider>
        <Settings flow={flow} />
      </SessionProvider>
    </OryPageLayout>
  )
}
```

Unlike the other flows, **`<Settings>` must be wrapped in `<SessionProvider>`**
from `@ory/elements-react/client`. Settings renders session-dependent controls
(connected social accounts, unlinking, logout of other sessions) that read from
the session context; the pre-auth pages (login, registration, recovery,
verification) have no session yet and do not need the provider.

### Settings — React SPA

Initialize with `createBrowserSettingsFlow` and render
`<Settings flow={flow} />` from `@ory/elements-react/theme`, wrapped in
`<SessionProvider>` from `@ory/elements-react/client` (the same requirement
as the App Router page above — Settings reads session-dependent state). The
component handles password changes, profile traits, MFA enrollment,
and connected social providers.

## Build the error page (do not skip — missing it causes 404s)

Ory redirects the browser to the error UI on **any** flow error (expired flow,
validation failure, misconfiguration). If that route doesn't exist the user
hits a 404 or a blank page instead of a readable message, and the failure looks
like a plugin bug when it's just a missing page.

Create `app/auth/error/page.tsx` and render the Elements error view for your
installed version (`getFlowError` from `@ory/nextjs/app` + the Elements error
component). Make sure its path matches the project's `error.ui_url`
(see `/project:ory-auth-setup`, Step 8). For a React SPA, fetch the error with
`getFlowError({ id })` from the `error` query param and display
`error.error.message`.

## Add session management

Create a **browser** utility to check the current session. (For server
components, route handlers, and middleware, use the `@ory/nextjs` server
helpers instead — they forward the request cookies. Reusing this browser client
on the server has no cookies and will 500/401.)

```typescript
import { FrontendApi, Configuration, Session } from "@ory/client-fetch";

const sdkUrl = process.env.NEXT_PUBLIC_ORY_SDK_URL;
if (!sdkUrl) {
  throw new Error("NEXT_PUBLIC_ORY_SDK_URL is not set — see ory-auth-setup Step 4.");
}

// Browser-only client. `credentials: "include"` only sends cookies in the browser,
// and sdkUrl must be your own origin (the tunnel/gateway in dev), not *.oryapis.com.
const ory = new FrontendApi(
  new Configuration({ basePath: sdkUrl, credentials: "include" }),
);

export async function getSession(): Promise<Session | null> {
  try {
    return await ory.toSession();
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  const { logout_url } = await ory.createBrowserLogoutFlow();
  window.location.href = logout_url;
}
```

## Add route protection

### Next.js Middleware

Create `middleware.ts` at the project root:

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

### React SPA

Wrap protected routes in a `ProtectedRoute` component that calls
`ory.toSession()` and redirects to `/auth/login` on failure.

## Style and customize

Ory Elements supports theming. Wrap auth pages in `<ThemeProvider>`
from `@ory/elements-react/theme` and pass a custom theme object.
Customizing the theme keeps the Elements rendering — you do not need
to drop down to raw nodes to restyle the forms.

```typescript
import { ThemeProvider } from "@ory/elements-react/theme";

<ThemeProvider theme={{
  // Custom colors, fonts, spacing, radii, dark mode tokens, …
}}>
  <Login flow={flow} />
</ThemeProvider>
```

For larger design changes, the Ory Elements primitives package exposes
the underlying card, button, and input components — use those before
falling back to custom node rendering.

## Enable MFA and passkeys

These are **project-side** capabilities: once enabled on the Ory project, the
`<Login>`, `<Registration>`, and `<Settings>` components render the second-factor
and passkey UI automatically — **no page code changes**. Configure them with the
Ory CLI against your project (`ory list projects` for the id), the same idiom as
`/project:ory-social-login`. Against the local stack, apply the equivalent keys to the
local Kratos config instead (`/project:ory-local-dev`).

### Passkeys

```bash
ory patch identity-config <project-id> \
  --add '/selfservice/methods/passkey/enabled=true' \
  --add '/selfservice/methods/passkey/config/rp/display_name="My App"' \
  --add '/selfservice/methods/passkey/config/rp/id="your-domain.com"' \
  --add '/selfservice/methods/passkey/config/rp/origins=["https://your-domain.com"]'
```

- `rp.id` is the **domain only** — no scheme, no port (`example.com`, not
  `https://example.com:3000`).
- `rp.origins` must list the **exact scheme+host+port** the browser uses.
- For local dev, WebAuthn treats `localhost` as a secure origin: set
  `rp.id="localhost"` and `rp.origins=["http://localhost:3000"]` (match your app
  URL). Passkeys registered against `localhost` won't work on the deployed domain
  and vice-versa.

### MFA methods

Enable the second factors you want. Backup codes (`lookup_secret`) should always
be enabled alongside any other method so a user who loses their device can
recover.

```bash
# TOTP (authenticator app)
ory patch identity-config <project-id> \
  --add '/selfservice/methods/totp/enabled=true' \
  --add '/selfservice/methods/totp/config/issuer="My App"'

# Backup codes
ory patch identity-config <project-id> \
  --add '/selfservice/methods/lookup_secret/enabled=true'

# Email code as a second factor
ory patch identity-config <project-id> \
  --add '/selfservice/methods/code/mfa_enabled=true'
```

### Require the second factor (do not skip)

Enabling a method only lets users *enroll* — it does not *require* the second
factor. Without this step MFA is opt-in and unenforced. Set the required
assurance level to the highest the identity has available:

```bash
ory patch identity-config <project-id> \
  --add '/selfservice/flows/settings/required_aal="highest_available"' \
  --add '/session/whoami/required_aal="highest_available"'
```

With `highest_available`, `toSession()` / `getServerSession()` return an
incomplete session (AAL1) until the user clears the second factor, and Elements
prompts for it on the next `<Login>`. Your route protection should treat an
AAL1 session on an MFA-enrolled user as unauthenticated.

## Test the flow

Don't stop at "the page renders." Run these in order — each one isolates a
different failure class:

1. Start the dev server **and the Ory tunnel** (local dev against Network), or
   the local stack. Confirm the browser SDK URL is your own origin, not
   `*.oryapis.com`.
2. **Flow API reachable (isolates Ory from your app):**

   ```bash
   curl -i "$NEXT_PUBLIC_ORY_SDK_URL/self-service/login/browser"
   ```

   Expect `200` and a `Set-Cookie: csrf_token...` header. If this fails it's the
   tunnel / Ory config, not your pages.
3. **No 404s:** visit `/auth/login`, `/auth/registration`, `/auth/recovery`,
   `/auth/verification`, `/auth/settings`, and `/auth/error` — each returns
   `200`. A 404 means a route/`ui_url` mismatch.
4. Register at `/auth/registration` — confirm Elements renders all configured
   methods (password, social, passkey, etc.).
5. Sign in at `/auth/login`; confirm a protected route loads, and redirects to
   login when signed out.
6. Test `/auth/recovery` with a registered email, `/auth/settings` for profile
   changes, and logout.

If a submit fails with a CSRF error, the SDK URL is cross-site (trap #1). If a
redirect 404s, a route doesn't match the project config (trap #2). Neither is a
plugin bug — see the **App bug vs. plugin bug** triage in `/project:ory-auth-setup`.

### Writing E2E tests (Playwright)

Automating these flows has three gotchas that cause flaky or wrong-for-the-wrong-
reason failures. Get them right up front:

1. **Match URLs by pattern, never literally.** Ory appends `?flow=<uuid>` on
   every flow redirect, so an exact-string wait never matches.

   ```typescript
   await page.waitForURL(/\/auth\/login\?flow=/)   // regex
   await page.waitForURL("**/dashboard**")          // glob — also matches query params
   // wrong: await page.waitForURL("http://localhost:3000/auth/login")
   ```

2. **Use strong, dissimilar credentials.** Kratos rejects passwords that are too
   similar to the identifier or that appear in a breach database — a weak fixture
   password fails validation, not the flow you meant to test.

   ```typescript
   const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
   const password = "Str0ngP@ssword!123"   // fixed, strong, not in any breach list
   ```

3. **Assert on Ory Elements' own testids, not form-level selectors.** Validation
   messages render inside the auth card, keyed by Kratos UI message id (the
   `4xxxxxx` range is validation errors), not on the flow wrapper.

   ```typescript
   page.locator('[data-testid^="ui/message/4"]')  // any validation error
   page.locator('[data-testid="login-auth-card"]').getByText(/credentials|invalid/i)
   // wrong: page.locator('[data-testid="login-flow"]').getByText(...) — errors aren't here
   ```

These selectors track the installed `@ory/elements-react` version; if a testid
assertion breaks after an Elements upgrade, inspect the rendered DOM before
assuming a flow bug.

## Fallback: rendering UI nodes by hand

Use this path **only** when Ory Elements cannot run in the target
environment (e.g., a Vue app where the React Elements components are
not viable, a server-rendered template engine with no client bundle,
or a constrained native shell). Before choosing this path, confirm
with the user that mounting an Elements island is not an option.

In that case, iterate `flow.ui.nodes` and render each node based on
`node.type` (`input`, `text`, `img`, `a`, `script`) and
`node.attributes`. Group nodes by `node.group` (`default`, `password`,
`oidc`, `webauthn`, `code`, `lookup_secret`, `totp`) so each method
renders together. Render `flow.ui.messages` and per-node messages for
errors. Submit using `flow.ui.action` and `flow.ui.method`. This is
significantly more code than `<Login flow={flow} />` and must track
Ory flow API changes manually.

## Next steps

- Add social login providers: use `/project:ory-social-login`.
  Elements renders the buttons automatically once providers are
  configured server-side.
- Add multi-factor authentication and passkeys — see **Enable MFA and
  passkeys** above. Once the project is configured, the `<Login>` and
  `<Settings>` components render the second-factor and passkey UI automatically.
- Customize the identity schema for additional profile fields. Elements
  reads the schema from the flow and renders new fields automatically.
- Set up webhooks for registration events.
