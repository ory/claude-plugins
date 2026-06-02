---
name: ory-social-login
description: Configure social login (OAuth2/OIDC) providers — Google, GitHub, Apple, Microsoft, Discord, Slack, GitLab, Facebook — for an Ory-powered app. Use whenever the user wants "Sign in with Google", social sign-in buttons, OIDC providers, or any third-party identity provider on an Ory project. The skill assumes Ory Elements is rendering the auth UI; with Elements, no frontend changes are needed when adding providers.
---

# Set up Social Login with Ory + Ory Elements

You are configuring social login (OAuth2/OIDC) providers for an
Ory-powered application. This adds "Sign in with Google",
"Sign in with GitHub", and similar buttons to the login and
registration flows.

**Strong recommendation: render the auth UI with [Ory Elements](https://github.com/ory/elements).**
With Ory Elements, social buttons appear automatically the moment a
provider is configured on the project — there is no frontend change
required for any of the providers below. If the app is using custom
flow rendering, point the user to `/project:ory-login-flow` and
recommend switching to Ory Elements before adding more providers.

## Prerequisites

1. **Ory CLI** — run `ory version`. If not installed:
   - macOS: `brew install ory/tap/cli`
   - npm: `npm install -g @ory/cli`

2. **Ory project** — run `ory list projects` to find the project ID.
   If no project exists, suggest `/project:ory-auth-setup` first.

3. **Auth pages built with Ory Elements** — confirm the project uses
   `@ory/elements-react` (look for `<Login>` / `<Registration>` from
   `@ory/elements-react/theme`). If pages are not built yet, suggest
   `/project:ory-login-flow` first. If a custom UI was hand-rolled,
   recommend migrating to Ory Elements so social buttons render for
   free.

## Step 1: Choose providers

Ask the user which social login providers they want. Common options:

| Provider | OIDC Type | What you need |
| ---------- | ----------- | --------------- |
| Google | OIDC | Google Cloud Console OAuth2 credentials |
| GitHub | OAuth2 | GitHub OAuth App or GitHub App |
| Apple | OIDC | Apple Developer account, Service ID |
| Microsoft | OIDC | Azure AD app registration |
| Discord | OAuth2 | Discord Developer Portal application |
| Slack | OIDC | Slack API app |
| GitLab | OIDC | GitLab application |
| Facebook | OAuth2 | Meta Developer app |

## Step 2: Create OAuth2 credentials with each provider

Guide the user through creating credentials for each selected provider.
They will need to set these up in the provider's developer console.

### Google

1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create an OAuth 2.0 Client ID (Web application type)
3. Add authorized redirect URI: `https://<project-slug>.projects.oryapis.com/self-service/methods/oidc/callback/google`
4. Copy the **Client ID** and **Client Secret**

### GitHub

1. Go to GitHub > Settings > Developer Settings > OAuth Apps > New OAuth App
2. Set the Authorization callback URL: `https://<project-slug>.projects.oryapis.com/self-service/methods/oidc/callback/github`
3. Copy the **Client ID** and **Client Secret**

### Apple

1. Go to Apple Developer > Certificates, Identifiers & Profiles
2. Create a Service ID, enable "Sign in with Apple"
3. Configure the return URL: `https://<project-slug>.projects.oryapis.com/self-service/methods/oidc/callback/apple`
4. Create a Key for Sign in with Apple, download the `.p8` file
5. You'll need: **Service ID** (client_id), **Team ID**, **Key ID**,
   and the **private key**

### Microsoft

1. Go to Azure Portal > Azure Active Directory > App Registrations > New Registration
2. Set redirect URI: `https://<project-slug>.projects.oryapis.com/self-service/methods/oidc/callback/microsoft`
3. Create a client secret under Certificates & Secrets
4. Copy the **Application (client) ID** and **Client Secret**

### Discord

1. Go to Discord Developer Portal > Applications > New Application
2. Under OAuth2, add redirect: `https://<project-slug>.projects.oryapis.com/self-service/methods/oidc/callback/discord`
3. Copy the **Client ID** and **Client Secret**

## Step 3: Configure providers in Ory

Use the Ory CLI to add each provider. The configuration uses JSON patches.

### Google OIDC

```bash
ory patch identity-config <project-id> \
  --add '/selfservice/methods/oidc/config/providers/-={
    "id": "google",
    "provider": "google",
    "client_id": "<GOOGLE_CLIENT_ID>",
    "client_secret": "<GOOGLE_CLIENT_SECRET>",
    "mapper_url": "base64://MAPPER_CONTENT",
    "scope": ["openid", "email", "profile"]
  }' \
  --replace '/selfservice/methods/oidc/enabled=true'
```

### GitHub OIDC

```bash
ory patch identity-config <project-id> \
  --add '/selfservice/methods/oidc/config/providers/-={
    "id": "github",
    "provider": "github",
    "client_id": "<GITHUB_CLIENT_ID>",
    "client_secret": "<GITHUB_CLIENT_SECRET>",
    "mapper_url": "base64://MAPPER_CONTENT",
    "scope": ["user:email"]
  }' \
  --replace '/selfservice/methods/oidc/enabled=true'
```

### Apple OIDC

```bash
ory patch identity-config <project-id> \
  --add '/selfservice/methods/oidc/config/providers/-={
    "id": "apple",
    "provider": "apple",
    "client_id": "<APPLE_SERVICE_ID>",
    "apple_team_id": "<TEAM_ID>",
    "apple_private_key_id": "<KEY_ID>",
    "apple_private_key": "<PRIVATE_KEY_CONTENTS>",
    "mapper_url": "base64://MAPPER_CONTENT",
    "scope": ["openid", "email", "name"]
  }' \
  --replace '/selfservice/methods/oidc/enabled=true'
```

### Microsoft OIDC

```bash
ory patch identity-config <project-id> \
  --add '/selfservice/methods/oidc/config/providers/-={
    "id": "microsoft",
    "provider": "microsoft",
    "client_id": "<MICROSOFT_CLIENT_ID>",
    "client_secret": "<MICROSOFT_CLIENT_SECRET>",
    "microsoft_tenant": "common",
    "mapper_url": "base64://MAPPER_CONTENT",
    "scope": ["openid", "email", "profile"]
  }' \
  --replace '/selfservice/methods/oidc/enabled=true'
```

### Discord OIDC

```bash
ory patch identity-config <project-id> \
  --add '/selfservice/methods/oidc/config/providers/-={
    "id": "discord",
    "provider": "discord",
    "client_id": "<DISCORD_CLIENT_ID>",
    "client_secret": "<DISCORD_CLIENT_SECRET>",
    "mapper_url": "base64://MAPPER_CONTENT",
    "scope": ["identify", "email"]
  }' \
  --replace '/selfservice/methods/oidc/enabled=true'
```

## Step 4: Create Jsonnet data mappers

Each provider needs a Jsonnet mapper that maps the provider's claims
to Ory identity traits. Create a mapper file for each provider.

### Standard email-based mapper

This works for Google, GitHub, Microsoft, Discord, and most providers:

```jsonnet
local claims = {
  email_verified: false,
} + std.extVar('claims');

{
  identity: {
    traits: {
      [if 'email' in claims && claims.email_verified then 'email' else null]: claims.email,
    },
  },
}
```

### Apple mapper

Apple sends name data only on first login:

```jsonnet
local claims = {
  email_verified: false,
} + std.extVar('claims');

{
  identity: {
    traits: {
      [if 'email' in claims && claims.email_verified then 'email' else null]: claims.email,
    },
  },
}
```

To use these mappers, either:

1. Base64-encode the Jsonnet and use `mapper_url: "base64://..."`
   in the provider config
2. Host the mapper at a URL and use `mapper_url: "https://..."`
   in the provider config

To base64-encode a mapper file:

```bash
base64 -i mapper.jsonnet
```

Then set `mapper_url` to `"base64://<encoded-content>"` in the provider configuration.

## Step 5: Verify social login in the UI (Ory Elements)

If the app uses Ory Elements (the recommended setup), **no frontend
changes are needed**. The `<Login>` and `<Registration>` components
read the available methods from the flow object and render the
appropriate social buttons automatically — including provider icons
and labels.

Reload the login page and confirm the new buttons appear. If they do
not:

- Confirm OIDC is enabled and the provider was added (Step 7
  troubleshooting commands).
- Confirm the page is rendering `<Login flow={flow} />` from
  `@ory/elements-react/theme`, not a custom UI.
- Confirm the flow was re-initialized after the provider was added
  (a stale flow id from before the change will not include the new
  buttons).

### Fallback: custom UI rendering of OIDC nodes

Use this only if the user has explicitly chosen not to use Ory
Elements. In that case, render the OIDC nodes from the flow:

```typescript
flow.ui.nodes
  .filter(node => node.group === "oidc")
  .map(node => {
    // Each node represents a social login button.
    // node.attributes contains the provider id and label.
    // Render a button that submits the form with the provider value.
  });
```

Before going down this path, recommend switching to Ory Elements via
`/project:ory-login-flow` so future provider additions don't require
frontend work.

## Step 6: Test each provider

For each configured provider:

1. Go to the login page
2. Click the social login button for the provider — Ory Elements
   should already be rendering it
3. Complete the OAuth flow with the provider
4. Verify you're redirected back and a session is created
5. Check the identity was created: `ory list identities --project <project-id>`
6. Test the registration flow — a new user signing in via social should auto-register
7. Test account linking — an existing user should be able to link a social provider

## Step 7: Handle account linking

When a user logs in with a social provider whose email matches an
existing account, Ory can either:

- **Link automatically** — merge the social identity with the existing account
- **Require manual linking** — prompt the user to log in with their
  existing method first

Configure the linking strategy:

```bash
ory patch identity-config <project-id> \
  --replace '/selfservice/methods/oidc/config/enabled=true'
```

When manual linking is required, Ory Elements renders the linking
prompt automatically — no UI work needed.

## Troubleshooting

- **Redirect URI mismatch**: Ensure the redirect URI in the provider's
  console exactly matches what Ory expects: `https://<slug>.projects.oryapis.com/self-service/methods/oidc/callback/<provider-id>`
- **No social buttons showing with Ory Elements**: Verify OIDC is
  enabled and at least one provider is configured:
  `ory get identity-config <project-id> --format json | jq '.selfservice.methods.oidc'`
  Then reload the page so a fresh flow is initialized.
- **No social buttons showing with a custom UI**: The custom UI must
  iterate `flow.ui.nodes` filtered by `group === "oidc"`. The simplest
  fix is to migrate to Ory Elements.
- **Mapper errors**: Test the Jsonnet mapper locally with sample claims data
- **Local development**: Use `ory tunnel` to proxy requests — social
  login requires proper cookie handling that localhost alone can't provide
