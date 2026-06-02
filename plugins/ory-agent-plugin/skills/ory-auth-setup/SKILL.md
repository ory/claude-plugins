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

## Step 1: Check prerequisites

Before installing the Ory CLI, decide where the auth backend will run:

- **Ory Network** (default for production-bound work) — continue with
  the steps below.
- **Local Ory stack** (no Network project required, ideal for
  prototyping, offline work, or automated tests) — switch to the
  `/project:ory-local-dev` skill. It manages a Dockerized
  Kratos/Keto/Hydra stack via `/ory:local-up` and `/ory:local-down`,
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

## Step 4: Configure the Ory SDK

Create a shared Ory client configuration. The SDK URL should come
from an environment variable:

```typescript
import { Configuration, FrontendApi } from "@ory/client-fetch";

const ory = new FrontendApi(
  new Configuration({
    basePath: process.env.NEXT_PUBLIC_ORY_SDK_URL || process.env.ORY_SDK_URL,
    credentials: "include",
  })
);

export default ory;
```

Add to the project's `.env` or `.env.local`:

```bash
NEXT_PUBLIC_ORY_SDK_URL=https://<project-slug>.projects.oryapis.com
# or
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
- `app/auth/settings/page.tsx` — `<Settings flow={flow} />`

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

Protect authenticated routes by checking the session:

```typescript
const session = await ory.toSession();
if (!session) {
  // Redirect to login
}
```

For Next.js, prefer the official `@ory/nextjs` middleware helper since
it pairs with the Elements pages:

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

## Step 8: Configure allowed redirect URLs

Update the Ory project to allow redirects back to your app:

```bash
ory patch project <project-id> \
  --replace '/services/identity/config/selfservice/allowed_return_urls=["http://localhost:3000", "https://your-domain.com"]'
```

## Step 9: Set up the Ory Tunnel for local development

For local development, use the Ory tunnel to proxy requests and handle cookies:

```bash
ory tunnel http://localhost:3000 --project <project-slug>
```

This runs a proxy on `http://localhost:4000` that handles cookie domains
correctly for local development. Update your SDK URL to point to the
tunnel during development.

## Step 10: Verify the setup

1. Start the development server
2. Navigate to the login page — confirm Ory Elements renders the form,
   including any social login buttons configured on the project
3. Create a test account via the registration page
4. Verify login works
5. Test account recovery flow
6. Test the verification flow
7. Check that protected routes redirect unauthenticated users

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
