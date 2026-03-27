#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

type OpenClawConfig = {
  plugins?: {
    allow?: string[];
    entries?: Record<string, { enabled?: boolean }>;
  };
  [k: string]: unknown;
};

type AgentLockRuntimeConfig = {
  backend_url: string;
  status_poll_ms: number;
  status_poll_ms_max: number;
  log_level: "debug" | "info" | "warn" | "error";
  subject_token?: string;
};
const OFFICIAL_BACKEND_URL = "https://agent-lock-backend.azurewebsites.net";

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function fail(msg: string): never {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function getInstallPaths() {
  const home = os.homedir();
  const extDir = path.join(home, ".openclaw", "extensions", "agent-lock");
  const openclawJson = path.join(home, ".openclaw", "openclaw.json");
  return { extDir, openclawJson };
}

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

function copyFileOrFail(src: string, dest: string): void {
  if (!fs.existsSync(src)) {
    fail(`Missing required file: ${src}`);
  }
  fs.copyFileSync(src, dest);
}

function readJson<T>(p: string, fallback: T): T {
  if (!fs.existsSync(p)) return fallback;
  const raw = fs.readFileSync(p, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(p: string, obj: unknown): void {
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

function registerInOpenClaw(openclawJson: string): void {
  const config = readJson<OpenClawConfig>(openclawJson, {});

  if (!config.plugins) config.plugins = {};
  if (!Array.isArray(config.plugins.allow)) config.plugins.allow = [];
  if (!config.plugins.entries || typeof config.plugins.entries !== "object") {
    config.plugins.entries = {};
  }

  if (!config.plugins.allow.includes("agent-lock")) {
    config.plugins.allow.push("agent-lock");
  }
  config.plugins.entries["agent-lock"] = { enabled: true };

  ensureDir(path.dirname(openclawJson));
  writeJson(openclawJson, config);
}

function validateUrl(url: string): void {
  try {
    const u = new URL(url);
    if (!u.protocol.startsWith("http")) throw new Error("invalid protocol");
  } catch {
    fail(`Invalid backend URL: ${url}`);
  }
}

function writeRuntimeConfig(extDir: string, cfg: AgentLockRuntimeConfig): void {
  writeJson(path.join(extDir, "agent-lock.config.json"), cfg);
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function discoverBackendUrl(): string {
  return normalizeBaseUrl(OFFICIAL_BACKEND_URL);
}

async function install(): Promise<void> {
  const { extDir, openclawJson } = getInstallPaths();
  const here = path.resolve(__dirname, "..");
  const distDir = path.join(here, "dist");
  const pluginManifest = path.join(here, "openclaw.plugin.json");
  const pkg = path.join(here, "package.json");

  ensureDir(extDir);
  copyFileOrFail(path.join(distDir, "index.js"), path.join(extDir, "index.js"));
  copyFileOrFail(path.join(distDir, "cli.js"), path.join(extDir, "cli.js"));
  copyFileOrFail(pluginManifest, path.join(extDir, "openclaw.plugin.json"));
  copyFileOrFail(pkg, path.join(extDir, "package.json"));

  registerInOpenClaw(openclawJson);
  const detected = discoverBackendUrl();
  writeRuntimeConfig(extDir, {
    backend_url: detected,
    status_poll_ms: 500,
    status_poll_ms_max: 2000,
    log_level: "info",
  });

  log("✅ Agent-Lock installed for OpenClaw");
  log(`   Extension: ${extDir}`);
  log(`   Config:    ${openclawJson}`);
  log("");
  log("🎉 Felicidades, estás conectado.");
  log("Siguiente paso:");
  log("  1) Verifica estado:");
  log("     agent-lock status");
  log("  2) Reinicia OpenClaw:");
  log("     openclaw restart");
}

async function connect(backendUrl?: string): Promise<void> {
  const { extDir, openclawJson } = getInstallPaths();

  if (!fs.existsSync(path.join(extDir, "index.js"))) {
    fail("Agent-Lock plugin not installed. Run: agent-lock install");
  }

  if (backendUrl?.trim()) {
    fail("This product uses a single global backend. Run: agent-lock connect");
  }
  const finalUrl = discoverBackendUrl();
  validateUrl(finalUrl);

  registerInOpenClaw(openclawJson);
  writeRuntimeConfig(extDir, {
    backend_url: finalUrl,
    status_poll_ms: 500,
    status_poll_ms_max: 2000,
    log_level: "info",
  });

  log("✅ Agent-Lock connected");
  log(`   Backend URL: ${finalUrl}`);
  log("");
  log("🎉 Felicidades, estás conectado.");
  log("Ahora reinicia OpenClaw con:");
  log("  openclaw restart");
  log("");
  log("Verificación recomendada:");
  log("  - Ejecuta una acción segura en OpenClaw");
  log("  - Revisa Dashboard: /overview, /activity, /logs");
}

function status(): void {
  const { extDir, openclawJson } = getInstallPaths();
  const installed = fs.existsSync(path.join(extDir, "index.js"));
  const cfg = readJson<OpenClawConfig>(openclawJson, {});
  const enabled = cfg.plugins?.entries?.["agent-lock"]?.enabled === true;
  const allowed = (cfg.plugins?.allow ?? []).includes("agent-lock");
  const runtimePath = path.join(extDir, "agent-lock.config.json");
  const runtime = readJson<Partial<AgentLockRuntimeConfig>>(runtimePath, {});
  const connected = installed && allowed && enabled && Boolean(runtime.backend_url);

  log(`installed: ${installed}`);
  log(`allowed:   ${allowed}`);
  log(`enabled:   ${enabled}`);
  log(`extDir:    ${extDir}`);
  log(`config:    ${openclawJson}`);
  log(`backend:   ${runtime.backend_url ?? "(not configured)"}`);
  log(`connected: ${connected}`);

  if (connected) {
    log("");
    log("🎉 Felicidades, estás conectado.");
    log("Reinicia OpenClaw con:");
    log("  openclaw restart");
  } else {
    log("");
    log("Aún no está completamente conectado. Haz esto:");
    if (!installed) {
      log("  1) agent-lock install");
    }
    if (installed && !runtime.backend_url) {
      log("  1) agent-lock connect");
    }
    log("  2) agent-lock status");
    log("  3) openclaw restart");
  }
}

function usage(): void {
  log("agent-lock <command>");
  log("");
  log("Commands:");
  log("  install   Install plugin and auto-connect to official backend");
  log("  connect   Re-connect to official backend");
  log("  status    Show installation status");
  log("");
  log("Examples:");
  log("  agent-lock install");
  log("  agent-lock connect");
}

async function main(): Promise<void> {
  const cmd = process.argv[2];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    usage();
    return;
  }
  if (cmd === "install") {
    await install();
    return;
  }
  if (cmd === "status") {
    status();
    return;
  }
  if (cmd === "connect") {
    const backendUrl = process.argv[3];
    await connect(backendUrl);
    return;
  }

  fail(`Unknown command: ${cmd}`);
}

void main();

