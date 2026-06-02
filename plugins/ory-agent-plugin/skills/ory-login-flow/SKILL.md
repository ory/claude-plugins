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
      <Settings flow={flow} />
    </OryPageLayout>
  )
}
```

### Settings — React SPA

Initialize with `createBrowserSettingsFlow` and render
`<Settings flow={flow} />` from `@ory/elements-react/theme`. The
component handles password changes, profile traits, MFA enrollment,
and connected social providers.

## Add session management

Create a utility to check the current session:

```typescript
import { FrontendApi, Configuration, Session } from "@ory/client-fetch";

const ory = new FrontendApi(
  new Configuration({
    basePath: process.env.NEXT_PUBLIC_ORY_SDK_URL,
    credentials: "include",
  })
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

## Test the flow

1. Start the dev server and Ory tunnel (if developing locally)
2. Visit `/auth/registration` to create an account — confirm Elements
   renders all configured methods (password, social, passkey, etc.)
3. Visit `/auth/login` to sign in
4. Verify session is established (check protected routes)
5. Test `/auth/recovery` with a registered email
6. Test `/auth/settings` for profile changes
7. Test logout

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
- Add multi-factor authentication via Ory project settings — the
  `<Login>` and `<Settings>` components handle the second-factor UI.
- Customize the identity schema for additional profile fields. Elements
  reads the schema from the flow and renders new fields automatically.
- Set up webhooks for registration events.
