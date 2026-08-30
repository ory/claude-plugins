#!/usr/bin/env node
/*
 * Ory MCP server bootstrap for claude-code.
 * Generated from @ory/argus — do not edit by hand.
 *
 * Loads the Ory plugin runtime that `npx -y -p @ory/claude-code ory-claude install` resolved on this
 * machine. Dependency-free on purpose: this file ships in a git install surface
 * that has no node_modules.
 */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HARNESS = "claude-code";
const INSTALL_COMMAND = "npx -y -p @ory/claude-code ory-claude install";

/** Mirror of `getDataDir()` in @ory/argus — keep the two in step. */
function dataDir() {
  const xdg = (process.env.XDG_CONFIG_HOME || "").trim();
  if (xdg) return path.join(xdg, "ory-agent-plugins");
  if (process.platform === "win32") {
    const appData = (process.env.APPDATA || "").trim();
    if (appData) return path.join(appData, "ory-agent-plugins");
  }
  return path.join(os.homedir(), ".config", "ory-agent-plugins");
}

/** The entry this bootstrap should load, or undefined when nothing is wired. */
function wiredEntry() {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(dataDir(), "runtime", "manifest.json"), "utf-8")
    );
    const wiring = (manifest.harnesses || {})[HARNESS] || {};
    const entry = wiring["mcpEntry"];
    return entry && fs.existsSync(entry) ? entry : undefined;
  } catch {
    return undefined;
  }
}

const entry = wiredEntry();
if (!entry) {
  process.stderr.write(
    "[ory-agent] no Ory MCP server runtime is installed. Run: " +
      INSTALL_COMMAND +
      "\n"
  );
  process.exit(1);
}
try {
  require(entry);
} catch (err) {
  process.stderr.write(
    "[ory-agent] Ory MCP server runtime at " +
      entry +
      " could not be loaded: " +
      ((err && err.message) || String(err)) +
      "\n"
  );
  process.exit(1);
}
