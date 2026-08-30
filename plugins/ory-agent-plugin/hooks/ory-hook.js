#!/usr/bin/env node
/*
 * Ory hook bootstrap for claude-code.
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
    const entry = wiring["hookEntry"];
    return entry && fs.existsSync(entry) ? entry : undefined;
  } catch {
    return undefined;
  }
}

const PACKAGE_NAME = "@ory/claude-code";
const BIN_NAME = "ory-claude";
const SESSION_START_EVENTS = ["SessionStart","session_start","sessionStart","TaskStart"];

/**
 * Complete the install once. Only ever called for a session-start event, where
 * there is time for it and nothing is waiting on a permission verdict.
 */
function materializeOnce() {
  const { spawnSync } = require("node:child_process");
  process.stderr.write(
    "[ory-agent] first run: installing the Ory plugin runtime (" +
      INSTALL_COMMAND +
      ")\n"
  );
  const result = spawnSync(
    "npx",
    ["-y", "-p", PACKAGE_NAME, BIN_NAME, "install"],
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf-8" }
  );
  if (result.status !== 0) {
    process.stderr.write(
      "[ory-agent] runtime install failed. Run it yourself: " +
        INSTALL_COMMAND +
        "\n" +
        (result.stderr || "").trim() +
        "\n"
    );
    return false;
  }
  return true;
}

function isSessionStart(payload) {
  if (!payload) return false;
  for (const key of ["hook_event_name", "hookName", "event", "eventName"]) {
    if (SESSION_START_EVENTS.indexOf(String(payload[key] || "")) !== -1) {
      return true;
    }
  }
  return false;
}

/** Fail open: say what to run, answer harmlessly, exit 0. */
function failOpen(reason) {
  process.stderr.write(
    "[ory-agent] " +
      reason +
      "\n[ory-agent] tools are NOT being checked. Run: " +
      INSTALL_COMMAND +
      "\n"
  );
  process.exit(0);
}

// Read stdin before deciding: whether a missing runtime may be installed
// depends on which event this is, and the payload carries the event name. The
// runtime's own hook entry reads stdin itself, so buffer and replay it.
//
// Buffers, not strings: every hook entry concatenates its chunks with
// `Buffer.concat`, which throws on a string chunk. Replaying byte-for-byte also
// keeps any non-ASCII payload intact.
const chunks = [];
process.stdin.on("data", (chunk) => {
  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
});
process.stdin.on("end", () => {
  const rawBuffer = Buffer.concat(chunks);
  let entry = wiredEntry();

  if (!entry) {
    let payload;
    try {
      payload = JSON.parse(rawBuffer.toString("utf-8"));
    } catch {
      payload = undefined;
    }
    // A tool event must never wait on npm: answer now, install at session start.
    if (!isSessionStart(payload)) {
      failOpen("no Ory plugin runtime is installed yet");
      return;
    }
    if (!materializeOnce()) {
      failOpen("no Ory plugin runtime is installed");
      return;
    }
    entry = wiredEntry();
    if (!entry) {
      failOpen("the runtime install reported success but wired nothing");
      return;
    }
  }

  const { Readable } = require("node:stream");
  Object.defineProperty(process, "stdin", {
    value: Readable.from([rawBuffer]),
    configurable: true,
  });

  try {
    require(entry);
  } catch (err) {
    failOpen(
      "plugin runtime at " +
        entry +
        " could not be loaded: " +
        ((err && err.message) || String(err))
    );
  }
});
