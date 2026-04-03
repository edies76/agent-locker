#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync, spawn } from "node:child_process";

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
const NPM_LOOKUP_TIMEOUT_MS = Number(process.env.AGENT_LOCK_NPM_LOOKUP_TIMEOUT_MS ?? "30000");
const NPM_INSTALL_TIMEOUT_MS = Number(process.env.AGENT_LOCK_NPM_INSTALL_TIMEOUT_MS ?? "300000");
const REQUEST_TIMEOUT_MS = Number(process.env.AGENT_LOCK_REQUEST_TIMEOUT_MS ?? "15000");

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

function readOpenClawConfig(): OpenClawConfig {
  const { openclawJson } = getInstallPaths();
  return readJson<OpenClawConfig>(openclawJson, {});
}

function isRegisteredInOpenClaw(): boolean {
  const cfg = readOpenClawConfig();
  const allowed = (cfg.plugins?.allow ?? []).includes("agent-lock");
  const enabled = cfg.plugins?.entries?.["agent-lock"]?.enabled === true;
  return allowed && enabled;
}

function hasExtensionFiles(): boolean {
  const { extDir } = getInstallPaths();
  return fs.existsSync(path.join(extDir, "index.js")) && fs.existsSync(path.join(extDir, "openclaw.plugin.json"));
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

function ensureRuntimeConfig(extDir: string): AgentLockRuntimeConfig {
  const runtimePath = path.join(extDir, "agent-lock.config.json");
  const current = readJson<Partial<AgentLockRuntimeConfig>>(runtimePath, {});
  const subjectToken = typeof current.subject_token === "string" && current.subject_token.trim()
    ? current.subject_token.trim()
    : `agent-lock-${Date.now()}`;

  const merged: AgentLockRuntimeConfig = {
    backend_url: typeof current.backend_url === "string" && current.backend_url.trim()
      ? current.backend_url
      : discoverBackendUrl(),
    status_poll_ms: typeof current.status_poll_ms === "number" ? current.status_poll_ms : 500,
    status_poll_ms_max: typeof current.status_poll_ms_max === "number" ? current.status_poll_ms_max : 2000,
    log_level: (current.log_level as AgentLockRuntimeConfig["log_level"]) ?? "warn",
    subject_token: subjectToken,
  };

  writeRuntimeConfig(extDir, merged);
  return merged;
}

async function backendGet(runtime: AgentLockRuntimeConfig, endpoint: string): Promise<any> {
  return backendRequest(runtime, endpoint, "GET");
}

async function backendPost(runtime: AgentLockRuntimeConfig, endpoint: string, body: unknown = {}): Promise<any> {
  return backendRequest(runtime, endpoint, "POST", body);
}

async function backendRequest(
  runtime: AgentLockRuntimeConfig,
  endpoint: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<any> {
  const base = normalizeBaseUrl(runtime.backend_url);
  const url = `${base}${endpoint}`;
  const headers: Record<string, string> = {};
  if (runtime.subject_token) {
    headers.Authorization = `Bearer ${runtime.subject_token}`;
  }
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    redirect: "follow",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openUrlInBrowser(url: string): boolean {
  try {
    if (process.platform === "win32") {
      const result = spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
      result.unref();
      return true;
    }
    if (process.platform === "darwin") {
      const result = spawn("open", [url], { detached: true, stdio: "ignore" });
      result.unref();
      return true;
    }
    const result = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    result.unref();
    return true;
  } catch {
    return false;
  }
}

async function waitForEnterOrSpace(timeoutMs: number): Promise<"trigger" | "timeout"> {
  if (!process.stdin.isTTY) {
    return "timeout";
  }
  return new Promise((resolve) => {
    let settled = false;
    const onData = (buf: Buffer) => {
      const value = buf.toString("utf8");
      if (value === "\r" || value === "\n" || value === " ") {
        cleanup();
        settled = true;
        resolve("trigger");
      }
    };
    const cleanup = () => {
      process.stdin.off("data", onData);
      try {
        process.stdin.setRawMode(false);
      } catch {}
      process.stdin.pause();
    };

    try {
      process.stdin.setRawMode(true);
    } catch {
      resolve("timeout");
      return;
    }
    process.stdin.resume();
    process.stdin.on("data", onData);

    setTimeout(() => {
      if (settled) return;
      cleanup();
      resolve("timeout");
    }, timeoutMs);
  });
}

async function waitForLoginCompletion(runtime: AgentLockRuntimeConfig, maxWaitMs = 300000): Promise<boolean> {
  const spinner = ["|", "/", "-", "\\"];
  let i = 0;
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    try {
      const me = await backendGet(runtime, "/auth/me");
      if (Boolean(me?.authenticated)) {
        process.stdout.write("\r✅ Login confirmado.                              \n");
        return true;
      }
    } catch {}
    const mark = spinner[i % spinner.length];
    process.stdout.write(`\r${mark} Esperando login en navegador...`);
    i += 1;
    await sleep(1500);
  }
  process.stdout.write("\r⏳ Tiempo de espera agotado.                      \n");
  return false;
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
    timeout: NPM_LOOKUP_TIMEOUT_MS,
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
    timeout: NPM_LOOKUP_TIMEOUT_MS,
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

  const hasLatest =
    Boolean(latest) &&
    Boolean(currentGlobal) &&
    Boolean(currentExtension) &&
    compareSemver(currentGlobal as string, latest as string) >= 0 &&
    compareSemver(currentExtension as string, latest as string) >= 0 &&
    hasExtensionFiles() &&
    isRegisteredInOpenClaw();

  if (hasLatest) {
    log("✅ Ya tienes la última versión instalada en global y OpenClaw.");
    log("   No se requiere uninstall/install.");
    log("");
    log("Siguiente paso:");
    log("  openclaw gateway restart");
    return;
  }

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
    timeout: NPM_INSTALL_TIMEOUT_MS,
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

  log("   Verifying uninstall state before reinstall...");
  const step1ExtRemoved = !hasExtensionFiles();
  const step1Unregistered = !isRegisteredInOpenClaw();
  log(`   - Extension files removed: ${step1ExtRemoved ? "yes" : "no"}`);
  log(`   - OpenClaw registration removed: ${step1Unregistered ? "yes" : "no"}`);
  if (!step1ExtRemoved || !step1Unregistered) {
    fail("❌ Step 2.5 failed verification: uninstall did not fully clean OpenClaw state.");
  }
  log("✅ Step 2.5 verification complete.");
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

  log("   Verifying final install state...");
  const step3ExtInstalled = hasExtensionFiles();
  const step3Registered = isRegisteredInOpenClaw();
  log(`   - Extension files present: ${step3ExtInstalled ? "yes" : "no"}`);
  log(`   - OpenClaw registration active: ${step3Registered ? "yes" : "no"}`);
  if (!step3ExtInstalled || !step3Registered) {
    fail("❌ Step 3.5 failed verification: install did not fully register in OpenClaw.");
  }
  log("✅ Step 3.5 verification complete.");
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
    log_level: "warn",
    subject_token: `agent-lock-${Date.now()}`,
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
    log_level: "warn",
    subject_token: `agent-lock-${Date.now()}`,
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

async function status(): Promise<void> {
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

  // Check authentication status if backend is configured
  let authenticated = false;
  if (runtime.backend_url && runtime.subject_token) {
    try {
      if (process.env.DEBUG) {
        console.error(`Checking auth: ${runtime.backend_url}/auth/me with token ${runtime.subject_token.substring(0, 20)}...`);
      }
      const data = await backendRequest(
        runtime as AgentLockRuntimeConfig,
        "/auth/me",
        "GET"
      );
      if (process.env.DEBUG) {
        console.error("Auth response:", JSON.stringify(data));
      }
      authenticated = data.authenticated === true;
    } catch (error) {
      // Backend might be down or request failed
      if (process.env.DEBUG) {
        console.error("Auth check failed:", error);
      }
    }
  } else {
    if (process.env.DEBUG) {
      console.error(`Skipping auth check: backend_url=${runtime.backend_url}, subject_token=${runtime.subject_token ? 'present' : 'missing'}`);
    }
  }

  log(`authenticated: ${authenticated}`);

  if (connected && authenticated) {
    log("");
    log("🎉 Felicidades, estás conectado y autenticado.");
    log("Reinicia OpenClaw con:");
    log("  openclaw gateway restart");
  } else if (connected && !authenticated) {
    log("");
    log("⚠️  Plugin conectado pero no autenticado.");
    log("Inicia sesión con:");
    log("  agent-lock login");
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

async function login(): Promise<void> {
  const { extDir } = getInstallPaths();
  const runtime = ensureRuntimeConfig(extDir);
  const encodedSubject = encodeURIComponent(runtime.subject_token ?? "default");
  const loginUrl = `${normalizeBaseUrl(runtime.backend_url)}/auth/login?subject_token=${encodedSubject}`;
  log("🔐 Agent-Lock login");
  log("Preparando para logearse...");
  log("Presiona Enter o Espacio para abrir navegador (auto en 3s).");

  const trigger = await waitForEnterOrSpace(3000);
  if (trigger === "trigger") {
    log("Abriendo navegador...");
  } else {
    log("Abriendo navegador automáticamente...");
  }

  const opened = openUrlInBrowser(loginUrl);
  if (!opened) {
    log(`No pude abrirlo automáticamente. Usa este link: ${loginUrl}`);
  }

  const ok = await waitForLoginCompletion(runtime);
  if (!ok) {
    fail("Login no confirmado todavía. Intenta de nuevo: agent-lock login");
  }
}

async function authStatus(): Promise<void> {
  const { extDir } = getInstallPaths();
  const runtime = ensureRuntimeConfig(extDir);
  try {
    const me = await backendGet(runtime, "/auth/me");
    const authenticated = Boolean(me?.authenticated);
    const sub = typeof me?.sub === "string" ? me.sub : "(none)";
    const email = typeof me?.claims?.email === "string" ? me.claims.email : "(not provided)";
    log("🔎 Agent-Lock auth status");
    log(`backend: ${runtime.backend_url}`);
    log(`authenticated: ${authenticated}`);
    log(`sub: ${sub}`);
    log(`email: ${email}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    fail(`auth-status failed: ${msg}`);
  }
}

async function logoutCmd(): Promise<void> {
  const { extDir } = getInstallPaths();
  const runtime = ensureRuntimeConfig(extDir);
  const targets = [normalizeBaseUrl(runtime.backend_url)];
  if (normalizeBaseUrl(runtime.backend_url) !== OFFICIAL_BACKEND_URL) {
    targets.push(OFFICIAL_BACKEND_URL);
  }
  const results: string[] = [];
  let success = false;

  for (const target of targets) {
    const targetRuntime: AgentLockRuntimeConfig = { ...runtime, backend_url: target };
    try {
      await backendPost(targetRuntime, "/auth/logout", {});
      results.push(`ok:${target}`);
      success = true;
      continue;
    } catch (error) {
      try {
        await backendGet(targetRuntime, "/auth/logout");
        results.push(`ok(get):${target}`);
        success = true;
      } catch (error2) {
        const msg = error2 instanceof Error ? error2.message : String(error2);
        results.push(`fail:${target}:${msg}`);
      }
    }
  }

  if (success) {
    log("✅ Agent-Lock logged out");
    log(`targets: ${results.join(" | ")}`);
    log("Next protected action should require login again.");
    return;
  }

  fail(`logout failed: ${results.join(" | ")}`);
}

async function cloudLogoutCmd(): Promise<void> {
  await logoutCmd();
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
  log("  login     Open browser login and wait for confirmation");
  log("  auth-status  Show current authenticated account");
  log("  logout    Force logout (configured backend + cloud fallback)");
  log("  cloud-logout  Alias of logout (deprecated)");
  log("");
  log("Examples:");
  log("  agent-lock install");
  log("  agent-lock connect");
  log("  agent-lock restart");
  log("  agent-lock uninstall");
  log("  agent-lock update");
  log("  agent-lock login");
  log("  agent-lock auth-status");
  log("  agent-lock logout");
  log("  agent-lock cloud-logout");
}

async function main(): Promise<void> {
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
    await status();
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
  if (cmd === "login") {
    await login();
    return;
  }
  if (cmd === "auth-status") {
    await authStatus();
    return;
  }
  if (cmd === "logout") {
    await logoutCmd();
    return;
  }
  if (cmd === "cloud-logout") {
    await cloudLogoutCmd();
    return;
  }

  fail(`Unknown command: ${cmd}`);
}

void main();

