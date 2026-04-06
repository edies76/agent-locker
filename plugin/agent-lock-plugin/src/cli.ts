#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
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
  dashboard_bridge_token?: string;
  preferred_channel?: "agentlock_dashboard" | "whatsapp" | "telegram";
  available_channels?: string[];
  client_label?: string;
  ws_bridge_token?: string; // deprecated alias (kept for backward compatibility)
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

function hasOpenClawCli(): boolean {
  const result = spawnSync("openclaw", ["--version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return (result.status ?? 1) === 0;
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
    dashboard_bridge_token:
      typeof current.dashboard_bridge_token === "string" && current.dashboard_bridge_token.trim()
        ? current.dashboard_bridge_token.trim()
        : (typeof current.ws_bridge_token === "string" && current.ws_bridge_token.trim()
          ? current.ws_bridge_token.trim()
          : undefined),
    preferred_channel:
      (typeof current.preferred_channel === "string" &&
        ["agentlock_dashboard", "whatsapp", "telegram"].includes(current.preferred_channel))
        ? (current.preferred_channel as AgentLockRuntimeConfig["preferred_channel"])
        : "agentlock_dashboard",
    available_channels:
      Array.isArray(current.available_channels) && current.available_channels.length > 0
        ? current.available_channels.map((x) => String(x))
        : ["agentlock_dashboard", "whatsapp", "telegram"],
    client_label:
      typeof current.client_label === "string" && current.client_label.trim()
        ? current.client_label.trim()
        : "openclaw",
    ws_bridge_token: current.ws_bridge_token,
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
      } catch { }
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
    } catch { }
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
    log("✅ You already have the latest version installed globally and in OpenClaw.");
    log("   No uninstall/install is required.");
    log("");
    log("Next step:");
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
    } catch { }
    fail(`❌ Step 2 failed (global install): ${npmResult.error.message}`);
  }
  if ((npmResult.status ?? 1) !== 0) {
    log("⚠️ Trying to restore previous OpenClaw extension after failed global install...");
    try {
      void install();
      log("✅ Previous extension restored.");
    } catch { }
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
    } catch { }
    fail(`❌ Step 3 failed (agent-lock install): ${installResult.error.message}`);
  }
  if ((installResult.status ?? 1) !== 0) {
    log("⚠️ Global CLI install step failed; restoring extension with current CLI...");
    try {
      void install();
      log("✅ Extension restored with current CLI build.");
    } catch { }
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
  log("Next step:");
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
  const existing = ensureRuntimeConfig(extDir);
  writeRuntimeConfig(extDir, {
    ...existing,
    backend_url: detected,
    status_poll_ms: 500,
    status_poll_ms_max: 2000,
    log_level: "info",
    subject_token: existing.subject_token ?? `agent-lock-${Date.now()}`,
  });

  log("✅ Agent-Lock installed for OpenClaw");
  log(`   Extension: ${extDir}`);
  log(`   Config:    ${openclawJson}`);
  log("");
  log("🎉 Success, you are connected.");
  log(`Backend preference: local (${LOCAL_BACKEND_URL}) -> cloud (${detected})`);
  log("Next step:");
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
  const existing = ensureRuntimeConfig(extDir);
  writeRuntimeConfig(extDir, {
    ...existing,
    backend_url: finalUrl,
    status_poll_ms: 500,
    status_poll_ms_max: 2000,
    log_level: "info",
    subject_token: existing.subject_token ?? `agent-lock-${Date.now()}`,
  });

  log("✅ Agent-Lock connected");
  log(`   Backend URL: ${finalUrl}`);
  log(`   Strategy: local (${LOCAL_BACKEND_URL}) -> cloud fallback`);
  log("");
  log("🎉 Success, you are connected.");
  log("Now restart OpenClaw with:");
  log("  openclaw gateway restart");
  log("");
  log("Recommended verification:");
  log("  - Run a safe action in OpenClaw");
  log("  - Review Dashboard: /overview, /activity, /logs");
}

async function status(): Promise<void> {
  const { extDir, openclawJson } = getInstallPaths();
  const installed = fs.existsSync(path.join(extDir, "index.js"));
  const cfg = readJson<OpenClawConfig>(openclawJson, {});
  const enabled = cfg.plugins?.entries?.["agent-lock"]?.enabled === true;
  const allowed = (cfg.plugins?.allow ?? []).includes("agent-lock");
  const runtime = ensureRuntimeConfig(extDir);
  const dashboardToken = runtime.dashboard_bridge_token ?? runtime.ws_bridge_token;
  const connected = installed && allowed && enabled && Boolean(runtime.backend_url);

  log(`installed: ${installed}`);
  log(`allowed:   ${allowed}`);
  log(`enabled:   ${enabled}`);
  log(`extDir:    ${extDir}`);
  log(`config:    ${openclawJson}`);
  log(`backend:   ${runtime.backend_url ?? "(not configured)"}`);
  log(`strategy:  local (${LOCAL_BACKEND_URL}) -> cloud fallback`);
  log(`channel:   ${runtime.preferred_channel ?? "agentlock_dashboard"}`);
  log(`dashboard_pairing_token: ${dashboardToken ? "(set)" : "(not set)"}`);
  log(`connected: ${connected}`);

  // Check authentication status if backend is configured
  let authenticated = false;
  if (runtime.backend_url && runtime.subject_token) {
    try {
      if (process.env.DEBUG) {
        console.error(`Checking auth: ${runtime.backend_url}/auth/me with token ${runtime.subject_token.substring(0, 20)}...`);
      }
      const data = await backendRequest(runtime, "/auth/me", "GET");
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

  let dashboardChannelConnected = false;
  if (runtime.backend_url && dashboardToken) {
    try {
      const pluginStatus = await backendGet(runtime, "/dashboard/plugin/status");
      dashboardChannelConnected = Boolean(pluginStatus?.connected);
    } catch {
      dashboardChannelConnected = false;
    }
  }
  log(`dashboard_channel_connected: ${dashboardChannelConnected}`);

  if (connected && authenticated) {
    log("");
    log("🎉 Success, you are connected and authenticated.");
    log("Reinicia OpenClaw con:");
    log("  openclaw gateway restart");
  } else if (connected && !authenticated) {
    log("");
    log("⚠️  Plugin connected but not authenticated.");
    log("Log in with:");
    log("  agent-lock login");
  } else {
    log("");
    log("It is not fully connected yet. Do this:");
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

async function login(provider?: string): Promise<void> {
  const { extDir } = getInstallPaths();
  const runtime = ensureRuntimeConfig(extDir);
  const encodedSubject = encodeURIComponent(runtime.subject_token ?? "default");
  const normalizedProvider = provider?.trim().toLowerCase();
  const connection =
    normalizedProvider === "google" ? "google-oauth2" :
      normalizedProvider === "github" ? "github" :
        normalizedProvider === "slack" ? "slack" :
          undefined;
  if (normalizedProvider && !connection) {
    fail("Invalid provider for login. Use: google | github | slack");
  }
  const loginUrl = connection
    ? `${normalizeBaseUrl(runtime.backend_url)}/auth/provider-login/${encodeURIComponent(normalizedProvider!)}?subject_token=${encodedSubject}&force_success=true`
    : `${normalizeBaseUrl(runtime.backend_url)}/auth/login?subject_token=${encodedSubject}&force_success=true`;
  log(connection ? `🔐 Agent-Lock login (${normalizedProvider})` : "🔐 Agent-Lock login");
  log("Preparing login...");
  log("Press Enter or Space to open the browser (auto in 3s).");

  const trigger = await waitForEnterOrSpace(3000);
  if (trigger === "trigger") {
    log("Opening browser...");
  } else {
    log("Opening browser automatically...");
  }

  const opened = openUrlInBrowser(loginUrl);
  if (!opened) {
    log(`Could not open it automatically. Use this link: ${loginUrl}`);
  }

  const ok = connection
    ? await (async () => {
      const started = Date.now();
      while (Date.now() - started < 300000) {
        try {
          const status = await backendGet(runtime, `/auth/providers/${normalizedProvider}/status`);
          if (Boolean(status?.connected)) {
            process.stdout.write(`\r✅ ${normalizedProvider} connected.                      \n`);
            return true;
          }
          if (String(status?.status ?? "") === "refresh_token_missing") {
            process.stdout.write(`\r❌ Missing refresh token in your primary session.           \n`);
            log("You need to re-login to your primary account to enable providers:");
            log("  1) agent-lock logout");
            log("  2) agent-lock login");
            log(`  3) agent-lock login ${normalizedProvider}`);
            return false;
          }
        } catch { }
        await sleep(1500);
      }
      return false;
    })()
    : await waitForLoginCompletion(runtime);
  if (!ok) {
    fail(connection
      ? `Login for ${normalizedProvider} is not confirmed yet. Try again: agent-lock login ${normalizedProvider}`
      : "Login is not confirmed yet. Try again: agent-lock login");
  }
}

async function authStatus(): Promise<void> {
  const { extDir } = getInstallPaths();
  const runtime = ensureRuntimeConfig(extDir);

  // Force use of configured backend (no fallback to local)
  const base = normalizeBaseUrl(runtime.backend_url);
  const url = `${base}/auth/me`;
  const headers: Record<string, string> = {};
  if (runtime.subject_token) {
    headers.Authorization = `Bearer ${runtime.subject_token}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const me = JSON.parse(text);
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

async function servicesStatus(): Promise<void> {
  const { extDir } = getInstallPaths();
  const runtime = ensureRuntimeConfig(extDir);
  const base = normalizeBaseUrl(runtime.backend_url);
  const url = `${base}/auth/services`;
  const headers: Record<string, string> = {};
  if (runtime.subject_token) {
    headers.Authorization = `Bearer ${runtime.subject_token}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = JSON.parse(text);
    const authenticated = Boolean(data?.authenticated);
    log("🔎 Agent-Lock services");
    log(`backend: ${runtime.backend_url}`);
    log(`authenticated: ${authenticated}`);
    if (typeof data?.source === "string" && data.source.trim()) {
      log(`source: ${data.source}`);
    }
    if (typeof data?.email === "string" && data.email.trim()) {
      log(`email: ${data.email}`);
    }

    const providers = Array.isArray(data?.providers) ? data.providers : [];
    if (providers.length === 0) {
      log("providers: (none)");
      return;
    }

    log("providers:");
    for (const p of providers) {
      const provider = typeof p?.provider === "string" ? p.provider : "unknown";
      const connected = Boolean(p?.connected);
      const icon = connected ? "✅" : "❌";
      const connection = typeof p?.connection === "string" ? p.connection : "-";
      const status = typeof p?.status === "string" ? p.status : "unknown";
      log(`  ${icon} ${provider} (${connection}) - ${status}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    fail(`services failed: ${msg}`);
  }
}

function parseProvider(argv: string[]): string {
  const provider = (argv[3] ?? "").trim().toLowerCase();
  if (!provider || !["google", "github", "slack"].includes(provider)) {
    fail("Invalid provider. Use: google | github | slack");
  }
  return provider;
}

async function providerLogin(provider: string): Promise<void> {
  await login(provider);
}

async function providerStatus(provider: string): Promise<void> {
  const { extDir } = getInstallPaths();
  const runtime = ensureRuntimeConfig(extDir);
  const data = await backendGet(runtime, `/auth/providers/${provider}/status`);
  const status = String(data?.status ?? "unknown");
  const connected = Boolean(data?.connected);

  log(`🔎 Agent-Lock provider status (${provider})`);
  log(`authenticated: ${Boolean(data?.authenticated)}`);
  log(`connected: ${connected}`);

  // Show clear explanation based on connection type
  if (status === "connected_via_primary_identity") {
    log(`status: ${status}`);
    log(`⚠️  This provider is your primary Agent-Lock identity`);
    log(`⚠️  You cannot disconnect it (use 'agent-lock logout' for full logout)`);
  } else if (status === "connected_via_connected_accounts") {
    log(`status: ${status}`);
    log(`ℹ️  Connected as a secondary account (you can use 'logout ${provider}')`);
  } else {
    log(`status: ${status}`);
  }

  if (typeof data?.login_url === "string" && data.login_url.trim()) {
    log(`login_url: ${data.login_url}`);
  }
}

async function providerLogout(provider: string): Promise<void> {
  const { extDir } = getInstallPaths();
  const runtime = ensureRuntimeConfig(extDir);
  const data = await backendPost(runtime, `/auth/providers/${provider}/logout`, {});
  const disconnected = Boolean(data?.disconnected);
  const reason = String(data?.reason ?? "unknown");

  log(`🚪 Agent-Lock provider logout (${provider})`);

  if (disconnected) {
    log(`✅ ${provider} disconnected successfully`);
  } else {
    log(`❌ Could not disconnect`);

    // Show clear explanation for why logout failed
    if (reason === "primary_identity_disconnect_not_supported" || reason === "connected_via_primary_identity") {
      log(`⚠️  Reason: This provider is your primary Agent-Lock identity`);
      log(`⚠️  You cannot disconnect it without full logout`);
      log(`💡 Use 'agent-lock logout' to sign out of your account`);
    } else if (reason === "refresh_token_missing") {
      log(`⚠️  Reason: No token available to disconnect (it was already disconnected)`);
    } else {
      log(`reason: ${reason}`);
    }
  }

  if (typeof data?.login_url === "string" && data.login_url.trim()) {
    log(`login_url: ${data.login_url}`);
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
  let auth0LogoutUrl: string | null = null;

  for (const target of targets) {
    const targetRuntime: AgentLockRuntimeConfig = { ...runtime, backend_url: target };
    try {
      const resp = await backendPost(targetRuntime, "/auth/logout", {});
      results.push(`ok:${target}`);
      success = true;
      // Get Auth0 logout URL from first successful response
      if (!auth0LogoutUrl && resp && typeof resp === 'object' && 'auth0_logout_url' in resp) {
        auth0LogoutUrl = (resp as any).auth0_logout_url;
      }
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

    // Open Auth0 logout to clear browser session too
    if (auth0LogoutUrl) {
      log("Signing out from Auth0...");
      const opened = openUrlInBrowser(auth0LogoutUrl);
      if (!opened) {
        log(`Abre este link para completar logout: ${auth0LogoutUrl}`);
      }
    }

    log("Next protected action should require login again.");
    return;
  }

  fail(`logout failed: ${results.join(" | ")}`);
}

async function cloudLogoutCmd(provider?: string): Promise<void> {
  if (provider && provider.trim()) {
    await providerLogout(provider.trim().toLowerCase());
    return;
  }
  await logoutCmd();
}

async function scopesCmd(provider?: string): Promise<void> {
  const { extDir } = getInstallPaths();
  const runtime = ensureRuntimeConfig(extDir);
  
  try {
    const providers = provider ? [provider.toLowerCase()] : ["google", "github", "slack"];
    log("🔑 Agent-Lock scopes");
    log(`backend: ${runtime.backend_url}`);
    for (const p of providers) {
      try {
        const data = await backendGet(runtime, `/auth/providers/${p}/scopes`);
        const available = Array.isArray(data?.available_scopes) ? data.available_scopes : [];
        const configured = Array.isArray(data?.configured_scopes) ? data.configured_scopes : available;
        const capability = Array.isArray(data?.capability_scopes) ? data.capability_scopes : [];
        const granted = Array.isArray(data?.granted_scopes) ? data.granted_scopes : [];
        log(`\n${p.toUpperCase()}:`);
        log(`  configured: ${configured.length} (${String(data?.scopes_source ?? "unknown")})`);
        log(`  capability: ${capability.length} (provider_catalog)`);
        log(`  granted:   ${granted.length} (${String(data?.granted_source ?? "unknown")})`);
        if (Array.isArray(data?.missing_from_granted) && data.missing_from_granted.length > 0) {
          log(`  missing:   ${data.missing_from_granted.length}`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`\n${p.toUpperCase()}: failed (${msg})`);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    fail(`Could not fetch scopes: ${msg}`);
  }
}

async function connectWsCmd(token?: string): Promise<void> {
  log("⚠️ connect-ws is deprecated. Use: agent-lock connect-channel");
  const { extDir } = getInstallPaths();
  const runtime = ensureRuntimeConfig(extDir);

  if (token) {
    runtime.dashboard_bridge_token = token.trim();
    runtime.ws_bridge_token = token.trim();
    runtime.preferred_channel = "agentlock_dashboard";
    runtime.available_channels = ["agentlock_dashboard", "whatsapp", "telegram"];
    runtime.client_label = "openclaw";
    writeRuntimeConfig(extDir, runtime);
    log(`✅ Dashboard channel token saved.`);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<void>((resolve) => {
    rl.question("🔑 Paste dashboard pairing token: ", (answer: string) => {
      rl.close();
      if (!answer.trim()) {
        fail("❌ Invalid or empty token.");
      }
      runtime.dashboard_bridge_token = answer.trim();
      runtime.ws_bridge_token = answer.trim();
      runtime.preferred_channel = "agentlock_dashboard";
      runtime.available_channels = ["agentlock_dashboard", "whatsapp", "telegram"];
      runtime.client_label = "openclaw";
      writeRuntimeConfig(extDir, runtime);
      log(`✅ Dashboard channel token saved.`);
      resolve();
    });
  });
}

function parseConnectChannelToken(argv: string[]): string | undefined {
  const args = argv.slice(3);
  if (args.length === 0) return undefined;
  if (args[0] === "--token") {
    const value = args[1]?.trim();
    if (!value) {
      fail("Missing value for --token. Usage: agent-lock connect-channel --token <TOKEN>");
    }
    return value;
  }
  return args[0].trim() || undefined;
}

function askForInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve((answer ?? "").trim());
    });
  });
}

async function connectChannel(tokenArg?: string): Promise<void> {
  const { extDir } = getInstallPaths();

  log("🔗 Agent-Lock connect-channel");

  if (!hasOpenClawCli()) {
    fail("OpenClaw CLI not found. Install OpenClaw first, then retry.");
  }
  log("✅ OpenClaw CLI detected");

  if (!hasExtensionFiles() || !isRegisteredInOpenClaw()) {
    fail("Agent-Lock plugin is not fully installed/configured in OpenClaw. Run: agent-lock install");
  }
  log("✅ Agent-Lock plugin installation detected");

  const runtime = ensureRuntimeConfig(extDir);

  let token = tokenArg?.trim();
  if (!token) {
    token = await askForInput("🔑 Paste dashboard pairing token: ");
  }
  if (!token) {
    fail("Invalid token: empty value.");
  }

  runtime.dashboard_bridge_token = token;
  runtime.ws_bridge_token = token; // compatibility alias
  runtime.preferred_channel = "agentlock_dashboard";
  runtime.available_channels = ["agentlock_dashboard", "whatsapp", "telegram"];
  runtime.client_label = "openclaw";
  writeRuntimeConfig(extDir, runtime);
  log("✅ Token and dashboard channel config saved");

  try {
    const hb = await backendPost(runtime, "/dashboard/plugin/heartbeat", {
      token,
      client_id: runtime.client_label ?? "openclaw",
      plugin_version: getExtensionInstalledVersion() ?? "unknown",
      available_channels: runtime.available_channels ?? ["agentlock_dashboard", "whatsapp", "telegram"],
      active_channel: runtime.preferred_channel ?? "agentlock_dashboard",
      metadata: {
        source: "agent-lock connect-channel",
        backend_url: runtime.backend_url,
      },
    });

    if (!hb?.ok) {
      fail(`Token not accepted by backend: ${hb?.error ?? "unknown error"}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    fail(`Could not validate pairing token with backend: ${msg}`);
  }

  let dashboardConnected = false;
  try {
    const status = await backendGet(runtime, "/dashboard/plugin/status");
    dashboardConnected = Boolean(status?.connected);
  } catch {
    dashboardConnected = false;
  }

  log("");
  log("🎉 Dashboard channel linked.");
  log("   channel: agentlock_dashboard");
  log(`   dashboard_connected: ${dashboardConnected}`);
  log("Next step:");
  log("  openclaw gateway restart");
}

function parseConnectWsToken(argv: string[]): string | undefined {
  const args = argv.slice(3);
  if (args.length === 0) return undefined;

  if (args[0] === "--token") {
    const value = args[1]?.trim();
    if (!value) {
      fail("Missing value for --token. Usage: agent-lock connect-ws --token <TOKEN>");
    }
    return value;
  }

  return args[0].trim() || undefined;
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
  log("Next step:");
  log("  openclaw gateway restart");
}

function usage(): void {
  log("agent-lock <command>");
  log("");
  log("Commands:");
  log("  install   Install plugin and auto-connect to official backend");
  log("  connect   Re-connect to official backend");
  log("  connect-channel  Pair OpenClaw with Dashboard channel using pairing token");
  log("  connect-ws Set token for dashboard channel (deprecated alias)");
  log("  status    Show installation status");
  log("  restart   Restart OpenClaw gateway");
  log("  uninstall Remove plugin from OpenClaw");
  log("  update    Update package and reinstall plugin");
  log("  login [provider]  Open browser login (optional provider: google|github|slack)");
  log("  auth-status  Show current authenticated account");
  log("  services  Show provider connection status (google/github/slack)");
  log("  provider-status <provider>  Show one provider status");
  log("  provider-logout <provider>  Disconnect one provider");
  log("  logout [provider]  Logout Agent-Lock session or disconnect one provider");
  log("  cloud-logout  Alias of logout (deprecated)");
  log("  scopes [provider]  Show available and permitted scopes");
  log("");
  log("Examples:");
  log("  agent-lock install");
  log("  agent-lock connect");
  log("  agent-lock connect-channel --token <PAIRING_TOKEN>");
  log("  agent-lock restart");
  log("  agent-lock uninstall");
  log("  agent-lock update");
  log("  agent-lock login");
  log("  agent-lock login github");
  log("  agent-lock auth-status");
  log("  agent-lock services");
  log("  agent-lock provider-status github");
  log("  agent-lock provider-logout github");
  log("  agent-lock logout");
  log("  agent-lock logout github");
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
  if (cmd === "connect-channel") {
    const token = parseConnectChannelToken(process.argv);
    await connectChannel(token);
    return;
  }
  if (cmd === "connect-ws") {
    const token = parseConnectWsToken(process.argv);
    await connectWsCmd(token);
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
    const provider = process.argv[3];
    await login(provider);
    return;
  }
  if (cmd === "auth-status") {
    await authStatus();
    return;
  }
  if (cmd === "services") {
    await servicesStatus();
    return;
  }
  if (cmd === "provider-status") {
    const provider = parseProvider(process.argv);
    await providerStatus(provider);
    return;
  }
  if (cmd === "provider-logout") {
    const provider = parseProvider(process.argv);
    await providerLogout(provider);
    return;
  }
  if (cmd === "logout") {
    const provider = process.argv[3];
    if (provider && provider.trim()) {
      await providerLogout(provider.trim().toLowerCase());
      return;
    }
    await logoutCmd();
    return;
  }
  if (cmd === "cloud-logout") {
    const provider = process.argv[3];
    await cloudLogoutCmd(provider);
    return;
  }
  if (cmd === "scopes") {
    const provider = process.argv[3];
    await scopesCmd(provider);
    return;
  }

  fail(`Unknown command: ${cmd}`);
}

void main();

