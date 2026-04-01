#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

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
const OFFICIAL_BACKEND_URL = "https://agent-lock-backend-api-7.azurewebsites.net";
const LOCAL_BACKEND_URL = "http://localhost:8000";

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

function getPackageVersionFromPath(packageJsonPath: string): string | null {
  const pkg = readJson<{ version?: string }>(packageJsonPath, {});
  return typeof pkg.version === "string" && pkg.version.trim() ? pkg.version.trim() : null;
}

function getExtensionInstalledVersion(): string | null {
  const { extDir } = getInstallPaths();
  return getPackageVersionFromPath(path.join(extDir, "package.json"));
}

function versionOrUnknown(version: string | null): string {
  return version ?? "unknown";
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

function unregisterFromOpenClaw(openclawJson: string): void {
  const config = readJson<OpenClawConfig>(openclawJson, {});

  if (config.plugins?.allow) {
    config.plugins.allow = config.plugins.allow.filter((name) => name !== "agent-lock");
  }

  if (config.plugins?.entries && typeof config.plugins.entries === "object") {
    delete config.plugins.entries["agent-lock"];
  }

  if (fs.existsSync(openclawJson)) {
    writeJson(openclawJson, config);
  }
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

function restartOpenClawGateway(): void {
  const result = spawnSync("openclaw", ["gateway", "restart"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    fail(`Failed to run OpenClaw gateway restart: ${result.error.message}`);
  }
  if ((result.status ?? 1) !== 0) {
    fail("OpenClaw gateway restart failed. Run manually: openclaw gateway restart");
  }
}

function parseSemver(version: string): [number, number, number] | null {
  const m = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function getGlobalInstalledVersion(): string | null {
  const result = spawnSync("npm", ["list", "-g", "@agentlock/agent-lock", "--depth=0", "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if ((result.status ?? 1) !== 0 || !result.stdout) return null;
  try {
    const parsed = JSON.parse(result.stdout) as {
      dependencies?: Record<string, { version?: string }>;
    };
    return parsed.dependencies?.["@agentlock/agent-lock"]?.version ?? null;
  } catch {
    return null;
  }
}

function getLatestPublishedVersion(): string | null {
  const result = spawnSync("npm", ["view", "@agentlock/agent-lock", "version", "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if ((result.status ?? 1) !== 0 || !result.stdout) return null;
  try {
    const parsed = JSON.parse(result.stdout) as string;
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return result.stdout.trim() || null;
  }
}

function update(): void {
  const currentGlobal = getGlobalInstalledVersion();
  const currentExtension = getExtensionInstalledVersion();
  const latest = getLatestPublishedVersion();

  log("🔄 Agent-Lock update started");
  log(`   Global version:    v${versionOrUnknown(currentGlobal)}`);
  log(`   OpenClaw version:  v${versionOrUnknown(currentExtension)}`);
  log(`   npm latest:        v${versionOrUnknown(latest)}`);
  log("");

  log("1) Uninstalling current OpenClaw extension...");
  try {
    uninstall();
    log("✅ Step 1 complete.");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    fail(`❌ Step 1 failed (uninstall): ${msg}`);
  }
  log("");

  log("2) Installing latest global package (@agentlock/agent-lock@latest)...");
  const npmResult = spawnSync("npm", ["i", "-g", "@agentlock/agent-lock@latest"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (npmResult.error) {
    log("⚠️ Trying to restore previous OpenClaw extension after failed global install...");
    try {
      void install();
      log("✅ Previous extension restored.");
    } catch {}
    fail(`❌ Step 2 failed (global install): ${npmResult.error.message}`);
  }
  if ((npmResult.status ?? 1) !== 0) {
    log("⚠️ Trying to restore previous OpenClaw extension after failed global install...");
    try {
      void install();
      log("✅ Previous extension restored.");
    } catch {}
    fail("❌ Step 2 failed (global install). Try manually: npm i -g @agentlock/agent-lock@latest");
  }
  const updatedGlobal = getGlobalInstalledVersion();
  log(`✅ Step 2 complete. Global now: v${versionOrUnknown(updatedGlobal)}`);
  log("");

  log("3) Reinstalling into OpenClaw with updated CLI...");
  const installResult = spawnSync("agent-lock", ["install"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (installResult.error) {
    log("⚠️ Global CLI install step failed; restoring extension with current CLI...");
    try {
      void install();
      log("✅ Extension restored with current CLI build.");
    } catch {}
    fail(`❌ Step 3 failed (agent-lock install): ${installResult.error.message}`);
  }
  if ((installResult.status ?? 1) !== 0) {
    log("⚠️ Global CLI install step failed; restoring extension with current CLI...");
    try {
      void install();
      log("✅ Extension restored with current CLI build.");
    } catch {}
    fail("❌ Step 3 failed (agent-lock install). Run manually: agent-lock install");
  }
  const updatedExtension = getExtensionInstalledVersion();
  log(`✅ Step 3 complete. OpenClaw extension now: v${versionOrUnknown(updatedExtension)}`);
  log("");

  log("4) Verification summary");
  log(`   Global:   v${versionOrUnknown(currentGlobal)} -> v${versionOrUnknown(updatedGlobal)}`);
  log(`   OpenClaw: v${versionOrUnknown(currentExtension)} -> v${versionOrUnknown(updatedExtension)}`);
  if (latest && updatedGlobal) {
    const cmp = compareSemver(updatedGlobal, latest);
    if (cmp < 0) {
      log(`⚠️ Global install is below npm latest (installed v${updatedGlobal}, latest v${latest}).`);
    } else {
      log(`✅ Installed version is aligned with npm latest (v${latest}).`);
    }
  }

  log("");
  log("🎉 Update completed correctly.");
  log("Siguiente paso:");
  log("  openclaw gateway restart");
}

function install(): void {
  const { extDir, openclawJson } = getInstallPaths();
  const here = path.resolve(__dirname, "..");
  const distDir = path.join(here, "dist");
  const pluginManifest = path.join(here, "openclaw.plugin.json");
  const pkg = path.join(here, "package.json");
  const packageVersion = getPackageVersionFromPath(pkg);

  log(`📦 Installing Agent-Lock v${versionOrUnknown(packageVersion)} into OpenClaw...`);
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
  log(`Preferencia de backend: local (${LOCAL_BACKEND_URL}) -> nube (${detected})`);
  log("Siguiente paso:");
  log("  1) Verifica estado:");
  log("     agent-lock status");
  log("  2) Reinicia OpenClaw:");
  log("     openclaw gateway restart");
}

function connect(backendUrl?: string): void {
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
  log(`   Strategy: local (${LOCAL_BACKEND_URL}) -> cloud fallback`);
  log("");
  log("🎉 Felicidades, estás conectado.");
  log("Ahora reinicia OpenClaw con:");
  log("  openclaw gateway restart");
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
  log(`strategy:  local (${LOCAL_BACKEND_URL}) -> cloud fallback`);
  log(`connected: ${connected}`);

  if (connected) {
    log("");
    log("🎉 Felicidades, estás conectado.");
    log("Reinicia OpenClaw con:");
    log("  openclaw gateway restart");
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
    log("  3) openclaw gateway restart");
  }
}

function uninstall(): void {
  const { extDir, openclawJson } = getInstallPaths();
  const previousVersion = getExtensionInstalledVersion();

  unregisterFromOpenClaw(openclawJson);
  fs.rmSync(extDir, { recursive: true, force: true });

  log("🧹 Agent-Lock uninstalled from OpenClaw");
  log(`   Previous version: v${versionOrUnknown(previousVersion)}`);
  log(`   Removed: ${extDir}`);
  log(`   Updated: ${openclawJson}`);
  log("");
  log("Siguiente paso:");
  log("  openclaw gateway restart");
}

function usage(): void {
  log("agent-lock <command>");
  log("");
  log("Commands:");
  log("  install   Install plugin and auto-connect to official backend");
  log("  connect   Re-connect to official backend");
  log("  status    Show installation status");
  log("  restart   Restart OpenClaw gateway");
  log("  uninstall Remove plugin from OpenClaw");
  log("  update    Update package and reinstall plugin");
  log("");
  log("Examples:");
  log("  agent-lock install");
  log("  agent-lock connect");
  log("  agent-lock restart");
  log("  agent-lock uninstall");
  log("  agent-lock update");
}

function main(): void {
  const cmd = process.argv[2];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    usage();
    return;
  }
  if (cmd === "install") {
    install();
    return;
  }
  if (cmd === "status") {
    status();
    return;
  }
  if (cmd === "connect") {
    const backendUrl = process.argv[3];
    connect(backendUrl);
    return;
  }
  if (cmd === "restart") {
    restartOpenClawGateway();
    return;
  }
  if (cmd === "uninstall") {
    uninstall();
    return;
  }
  if (cmd === "update") {
    update();
    return;
  }

  fail(`Unknown command: ${cmd}`);
}

main();

