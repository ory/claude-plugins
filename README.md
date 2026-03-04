# Ory Claude Plugins

Official [Claude Code](https://claude.ai) plugin marketplace for [Ory](https://github.com/ory).

## Installation

```bash
claude plugin add --marketplace github:ory-corp/claude-plugins
```

## Available Plugins

| Plugin | Description | Repository |
|--------|-------------|------------|
| [lumen](https://github.com/ory/lumen) | Precise local semantic code search via MCP | [ory/lumen](https://github.com/ory/lumen) |

## How It Works

This repository contains a `.claude-plugin/marketplace.json` that acts as a registry pointing Claude Code to Ory plugin repositories. Each plugin's metadata (version, description, keywords, etc.) is defined in the plugin's own `plugin.json` — this marketplace only references them by source.

### Versioning

Plugin versions are managed in their respective repositories. For example, `lumen` uses [release-please](https://github.com/googleapis/release-please) to bump the version in its `plugin.json` on each release. The marketplace always resolves to the latest version on the plugin's default branch.

## Adding a New Plugin

Add an entry to the `plugins` array in `.claude-plugin/marketplace.json`:

```json
{
  "name": "your-plugin",
  "source": {
    "source": "github",
    "repo": "ory/your-plugin"
  }
}
```

The plugin repository must contain a `.claude-plugin/plugin.json` with the full plugin metadata.

## License

[Apache-2.0](LICENSE)
