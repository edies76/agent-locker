#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync, spawn } from "node:child_process";

// ── Constants ────────────────────────────────────────────────────────────────
const PACKAGE_NAME = "@agentlock/mcp-server";
const OFFICIAL_BACKEND_URL = "https://agent-lock-backend-api-7.azurewebsites.net";
const NPM_LOOKUP_TIMEOUT_MS = Number(process.env.AGENT_LOCK_NPM_LOOKUP_TIMEOUT_MS ?? "30000");
const NPM_INSTALL_TIMEOUT_MS = Number(process.env.AGENT_LOCK_NPM_INSTALL_TIMEOUT_MS ?? "300000");

// ── Curated default MCP servers ──────────────────────────────────────────────
// These are bundled with every Agent-Lock installation.
// Servers marked enabled:true work out of the box (no API keys required).
// Servers marked enabled:false need environment variables — they appear in
// the config so the user can activate them by adding their credentials.
const DEFAULT_SERVERS: Array<{
    name: string;
    label: string;
    description: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    enabled: boolean;
    requires?: string;
}> = [
    {
        name: "filesystem",
        label: "Filesystem",
        description: "Read and write files in your Documents folder.",
        command: "npx",
        args: ["-y", "@anthropic/mcp-server-filesystem", os.homedir() + "/Documents"],
        enabled: true,
    },
    {
        name: "puppeteer",
        label: "Puppeteer (Browser)",
        description: "Control a real browser — scrape pages, take screenshots, fill forms.",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-puppeteer"],
        enabled: true,
    },
    {
        name: "fetch",
        label: "Fetch (HTTP)",
        description: "Make HTTP requests to any URL — read APIs, download content.",
        command: "npx",
        args: ["-y", "@anthropic/mcp-server-fetch"],
        enabled: true,
    },
    {
        name: "memory",
        label: "Memory",
        description: "Persistent memory store — Claude remembers facts across conversations.",
        command: "npx",
        args: ["-y", "@anthropic/mcp-server-memory"],
        enabled: true,
    },
    {
        name: "sequential-thinking",
        label: "Sequential Thinking",
        description: "Structured multi-step reasoning for complex problems.",
        command: "npx",
        args: ["-y", "@anthropic/mcp-server-sequential-thinking"],
        enabled: true,
    },
    {
        name: "github",
        label: "GitHub",
        description: "Create issues, PRs, clone repos. Requires GITHUB_TOKEN.",
        command: "npx",
        args: ["-y", "@anthropic/mcp-server-github"],
        env: { GITHUB_TOKEN: "" },
        enabled: false,
        requires: "Set GITHUB_TOKEN in the env block to activate.",
    },
    {
        name: "brave-search",
        label: "Brave Search",
        description: "Real-time web search. Requires BRAVE_API_KEY (free tier available).",
        command: "npx",
        args: ["-y", "@anthropic/mcp-server-brave-search"],
        env: { BRAVE_API_KEY: "" },
        enabled: false,
        requires: "Get a free key at brave.com/search/api and set BRAVE_API_KEY.",
    },
    {
        name: "postgres",
        label: "PostgreSQL",
        description: "Query your Postgres database. Requires a connection string.",
        command: "npx",
        args: ["-y", "@anthropic/mcp-server-postgres", "postgresql://localhost/mydb"],
        enabled: false,
        requires: "Replace the connection string in the args array.",
    },
];


type MCPConfig = {
    target_servers: Array<{
        name: string;
        command: string;
        args: string[];
        env?: Record<string, string>;
        enabled?: boolean;
    }>;
    backend_url: string;
    subject_token?: string;
    auto_approve_low_risk: boolean;
    require_approval_for_high: boolean;
    require_approval_for_critical: boolean;
    approval_timeout_seconds: number;
    local_cache_ttl: number;
    audit_log_path: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function log(msg: string): void {
    process.stdout.write(`${msg}\n`);
}

function err(msg: string): void {
    process.stderr.write(`${msg}\n`);
}

function fail(msg: string): never {
    process.stderr.write(`❌ ${msg}\n`);
    process.exit(1);
}

function getInstallPaths() {
    const home = os.homedir();
    const configDir = path.join(home, ".agent-lock");
    const configFile = path.join(configDir, "mcp_config.json");
    const pythonDir = path.join(configDir, "mcp_server");
    return { configDir, configFile, pythonDir };
}

function ensureDir(p: string): void {
    fs.mkdirSync(p, { recursive: true });
}

function readJson<T>(p: string, fallback: T): T {
    if (!fs.existsSync(p)) return fallback;
    try {
        return JSON.parse(fs.readFileSync(p, "utf8")) as T;
    } catch {
        return fallback;
    }
}

function writeJson(p: string, obj: unknown): void {
    fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

function getPackageVersion(): string {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = readJson<{ version?: string }>(pkgPath, {});
    return pkg.version ?? "unknown";
}

function versionOrUnknown(v: string | null): string {
    return v ?? "unknown";
}

function checkPython(): { available: boolean; command: string; version: string } {
    for (const cmd of ["python3", "python"]) {
        const result = spawnSync(cmd, ["--version"], {
            encoding: "utf8",
            shell: process.platform === "win32",
        });
        if (result.status === 0) {
            const version = (result.stdout || result.stderr).trim().replace("Python ", "");
            return { available: true, command: cmd, version };
        }
    }
    return { available: false, command: "", version: "" };
}

function checkPythonDeps(pythonCmd: string): boolean {
    const result = spawnSync(pythonCmd, ["-c", "import mcp, httpx"], {
        encoding: "utf8",
        shell: process.platform === "win32",
    });
    return result.status === 0;
}

// ── Claude Desktop config helpers ────────────────────────────────────────────

function getClaudeConfigPath(): string | null {
    if (process.platform === "win32") {
        // Claude Desktop on Windows is sometimes in a sandboxed Packages path or plain APPDATA
        const appdata = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
        // Try sandboxed path first (Microsoft Store install)
        const pkgsDir = path.join(os.homedir(), "AppData", "Local", "Packages");
        if (fs.existsSync(pkgsDir)) {
            const entries = fs.readdirSync(pkgsDir).filter(d => d.startsWith("Claude_"));
            if (entries.length > 0) {
                return path.join(pkgsDir, entries[0], "LocalCache", "Roaming", "Claude", "claude_desktop_config.json");
            }
        }
        return path.join(appdata, "Claude", "claude_desktop_config.json");
    } else if (process.platform === "darwin") {
        return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
    }
    return null;
}

function patchClaudeConfig(): boolean {
    const configPath = getClaudeConfigPath();
    if (!configPath) {
        log("  ⚠️  Could not auto-detect Claude Desktop config path on this OS.");
        printManualConfig();
        return false;
    }

    let claudeCfg: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
        try {
            claudeCfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
        } catch {
            claudeCfg = {};
        }
    }

    if (!claudeCfg.mcpServers || typeof claudeCfg.mcpServers !== "object") {
        claudeCfg.mcpServers = {};
    }
    (claudeCfg.mcpServers as Record<string, unknown>)["agent-lock"] = {
        command: "npx",
        args: ["-y", "@agentlock/mcp-server"],
    };

    ensureDir(path.dirname(configPath));
    fs.writeFileSync(configPath, JSON.stringify(claudeCfg, null, 2) + "\n", "utf8");
    log(`  ✅ Claude Desktop config patched`);
    log(`     → ${configPath}`);
    return true;
}

function printManualConfig(): void {
    log("");
    log('  Add this to your claude_desktop_config.json under "mcpServers":');
    log("");
    log('  "agent-lock": {');
    log('    "command": "npx",');
    log('    "args": ["-y", "@agentlock/mcp-server"]');
    log('  }');
    log("");
    log(`  File location (Windows): %APPDATA%\\Claude\\claude_desktop_config.json`);
    log(`  File location (macOS):   ~/Library/Application Support/Claude/claude_desktop_config.json`);
}

// ── Commands ─────────────────────────────────────────────────────────────────

function install(silent = false): void {
    const version = getPackageVersion();
    if (!silent) log(`📦 Installing Agent-Lock MCP Server v${version}...`);

    const { configDir, configFile, pythonDir } = getInstallPaths();
    const python = checkPython();

    if (!python.available) {
        fail("Python 3.8+ is required but not found. Install Python and try again.");
    }
    if (!silent) log(`   Python: ${python.command} (${python.version})`);

    // Copy Python MCP server files bundled inside this npm package
    const sourcePython = path.join(__dirname, "..", "python");
    if (!fs.existsSync(sourcePython)) {
        fail(`Python source not found at ${sourcePython}. Package may be corrupted.`);
    }

    ensureDir(pythonDir);
    for (const file of fs.readdirSync(sourcePython)) {
        if (file.endsWith(".py")) {
            fs.copyFileSync(
                path.join(sourcePython, file),
                path.join(pythonDir, file)
            );
        }
    }
    if (!silent) log(`   Copied MCP server to: ${pythonDir}`);

    // Install Python dependencies if needed
    if (!checkPythonDeps(python.command)) {
        if (!silent) log("   Installing Python dependencies (mcp, httpx)...");
        const pipResult = spawnSync(
            python.command,
            ["-m", "pip", "install", "--quiet", "mcp", "httpx"],
            {
                stdio: silent ? "pipe" : "inherit",
                shell: process.platform === "win32",
            }
        );
        if (pipResult.status !== 0) {
            log("  ⚠️  Could not auto-install Python deps. Run manually:");
            log(`      ${python.command} -m pip install mcp httpx`);
        } else if (!silent) {
            log("   Python dependencies installed.");
        }
    }

    // Create default mcp_config.json if it does not exist
    if (!fs.existsSync(configFile)) {
        const defaultConfig: MCPConfig = {
            // Pre-bundled curated servers — 5 enabled by default, 3 need config first
            target_servers: DEFAULT_SERVERS.map(s => ({
                name: s.name,
                command: s.command,
                args: s.args,
                env: s.env ?? {},
                enabled: s.enabled,
            })),
            backend_url: OFFICIAL_BACKEND_URL,
            subject_token: "",
            auto_approve_low_risk: true,
            require_approval_for_high: true,
            require_approval_for_critical: true,
            approval_timeout_seconds: 300,
            local_cache_ttl: 3600,
            audit_log_path: "logs/mcp_audit.jsonl",
        };
        ensureDir(configDir);
        writeJson(configFile, defaultConfig);
        if (!silent) {
            const enabled = DEFAULT_SERVERS.filter(s => s.enabled).length;
            const disabled = DEFAULT_SERVERS.filter(s => !s.enabled).length;
            log(`   Created config with ${enabled} servers enabled, ${disabled} ready to activate`);
            log(`   Config: ${configFile}`);
        }
    } else {
        if (!silent) log(`   Config exists: ${configFile}`);
    }

    if (!silent) {
        log("");
        log("✅ Agent-Lock MCP Server installed!");
    }
}

function setup(): void {
    log("");
    log("🦞  Agent-Lock MCP Server — Setup");
    log("=".repeat(50));
    log("");

    // ── Step 1: Install Python server + config ────────────────────────────────
    log("Step 1/2 — Installing MCP server files...");
    install(true);
    const { configFile } = getInstallPaths();
    log(`  ✅ MCP server installed`);
    log(`  ✅ Config ready → ${configFile}`);

    // ── Step 2: Patch Claude Desktop config ───────────────────────────────────
    log("");
    log("Step 2/2 — Patching Claude Desktop config...");
    patchClaudeConfig();

    // ── Done ──────────────────────────────────────────────────────────────────
    log("");
    log("=".repeat(50));
    log("✅  Setup complete!");
    log("");
    log("Next steps:");
    log("  1. Restart Claude Desktop completely (quit → reopen).");
    log("  2. Open a new chat and type: agent_lock__status");
    log("  3. To add MCP servers to protect, edit:");
    log(`       ${configFile}`);
    log("");
    log("  📖 Full docs: https://github.com/edies76/agent-locker");
    log("");
}

function status(): void {
    const { configFile, pythonDir } = getInstallPaths();
    const version = getPackageVersion();
    const installedVersion = getInstalledVersion();
    const latestVersion = getLatestPublishedVersion();
    const python = checkPython();
    const configExists = fs.existsSync(configFile);
    const serverInstalled = fs.existsSync(path.join(pythonDir, "server.py"));

    log(`🦞 Agent-Lock MCP Server`);
    log("");
    log(`  package_version:   v${version}`);
    log(`  installed_version: v${versionOrUnknown(installedVersion)}`);
    log(`  npm_latest:        v${versionOrUnknown(latestVersion)}`);
    log("");
    log(`  server_installed:  ${serverInstalled}`);
    log(`  config_exists:     ${configExists}`);
    log(`  config_path:       ${configFile}`);
    log(`  python:            ${python.available ? `${python.command} (${python.version})` : "(not found)"}`);
    log(`  backend_url:       ${OFFICIAL_BACKEND_URL}`);

    if (configExists) {
        const config = readJson<Partial<MCPConfig>>(configFile, {});
        log("");
        log("  Target servers:");
        const servers = config.target_servers ?? [];
        if (servers.length === 0) {
            log("    (none — edit config to add MCP servers to protect)");
        } else {
            for (const srv of servers) {
                const state = srv.enabled === false ? " [disabled]" : "";
                log(`    • ${srv.name}: ${srv.command} ${(srv.args ?? []).join(" ")}${state}`);
            }
        }
        log(`  subject_token:     ${config.subject_token ? "(set)" : "(not set)"}`);
    }

    log("");
    if (!python.available) {
        log("⚠️  Python not found. Install Python 3.8+");
    } else if (!serverInstalled) {
        log("⚠️  MCP server not installed. Run: npx @agentlock/mcp-server setup");
    } else if (latestVersion && installedVersion && installedVersion !== latestVersion) {
        log(`⚠️  Update available: v${installedVersion} → v${latestVersion}`);
        log("   Run: npx @agentlock/mcp-server update");
    } else {
        log("🎉 Ready. Restart Claude Desktop to apply any config changes.");
    }
}

function serve(transport: string = "stdio", port: number = 8001): void {
    const { pythonDir, configFile } = getInstallPaths();
    const python = checkPython();

    if (!python.available) {
        fail("Python not found. Install Python 3.8+");
    }

    const serverPy = path.join(pythonDir, "server.py");
    if (!fs.existsSync(serverPy)) {
        // Auto-install silently if missing (first run via npx)
        install(true);
    }

    // stdio mode: do NOT log to stdout — it would corrupt the MCP json stream
    if (transport !== "stdio") {
        err(`🦞 Starting Agent-Lock MCP Gateway (${transport}:${port})...`);
    }

    const pyArgs = ["-m", "mcp_server"];
    if (transport !== "stdio") {
        pyArgs.push("--transport", transport, "--port", String(port));
    }
    pyArgs.push("--config", configFile);

    const serverProcess = spawn(python.command, pyArgs, {
        cwd: path.dirname(pythonDir),
        stdio: transport === "stdio" ? "inherit" : ["ignore", "inherit", "inherit"],
        shell: process.platform === "win32",
        env: {
            ...process.env,
            PYTHONPATH: path.dirname(pythonDir),
        },
    });

    serverProcess.on("error", (e) => {
        fail(`Failed to start MCP server: ${e.message}`);
    });

    serverProcess.on("exit", (code) => {
        if (code !== 0 && code !== null) {
            process.exit(code);
        }
    });
}

function configPath(): void {
    const { configFile } = getInstallPaths();
    log(configFile);
}

function addServer(name: string, command: string, argsStr: string): void {
    const { configFile } = getInstallPaths();
    const config = readJson<MCPConfig>(configFile, {
        target_servers: [],
        backend_url: OFFICIAL_BACKEND_URL,
        auto_approve_low_risk: true,
        require_approval_for_high: true,
        require_approval_for_critical: true,
        approval_timeout_seconds: 300,
        local_cache_ttl: 3600,
        audit_log_path: "logs/mcp_audit.jsonl",
    });

    const args = argsStr ? argsStr.split(" ") : [];
    config.target_servers.push({ name, command, args, enabled: true });

    writeJson(configFile, config);
    log(`✅ Added server: ${name}`);
    log(`   Command: ${command} ${args.join(" ")}`);
    log(`   Config:  ${configFile}`);
}

function uninstall(): void {
    const { pythonDir, configFile } = getInstallPaths();
    const version = getInstalledVersion();

    log(`🧹 Uninstalling Agent-Lock MCP Server v${versionOrUnknown(version)}...`);

    if (fs.existsSync(pythonDir)) {
        fs.rmSync(pythonDir, { recursive: true, force: true });
        log(`   Removed: ${pythonDir}`);
    }

    log("");
    log("✅ Uninstalled.");
    log(`   Config preserved: ${configFile}`);
    log("   (Delete it manually if you want a full clean slate)");
}

function getLatestPublishedVersion(): string | null {
    const result = spawnSync("npm", ["view", PACKAGE_NAME, "version", "--json"], {
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

function getInstalledVersion(): string | null {
    const { pythonDir } = getInstallPaths();
    const initPy = path.join(pythonDir, "__init__.py");
    if (!fs.existsSync(initPy)) return null;
    try {
        const content = fs.readFileSync(initPy, "utf8");
        const match = content.match(/__version__\s*=\s*["']([^"']+)["']/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

function update(): void {
    const currentInstalled = getInstalledVersion();
    const latest = getLatestPublishedVersion();

    log("🔄 Agent-Lock MCP Server — Update");
    log(`   Installed: v${versionOrUnknown(currentInstalled)}`);
    log(`   Latest:    v${versionOrUnknown(latest)}`);
    log("");

    log("1) Removing current MCP server files...");
    const { pythonDir } = getInstallPaths();
    if (fs.existsSync(pythonDir)) {
        fs.rmSync(pythonDir, { recursive: true, force: true });
    }
    log("   ✅ Removed");
    log("");

    log("2) Fetching & installing latest package...");
    const npmResult = spawnSync(
        "npm",
        ["i", "-g", `${PACKAGE_NAME}@latest`],
        { stdio: "inherit", shell: process.platform === "win32", timeout: NPM_INSTALL_TIMEOUT_MS }
    );
    if ((npmResult.status ?? 1) !== 0) {
        fail(`npm install failed. Try: npm i -g ${PACKAGE_NAME}@latest`);
    }
    log("   ✅ npm updated");
    log("");

    log("3) Reinstalling MCP server files...");
    install(true);
    const updatedVersion = getInstalledVersion();
    log(`   ✅ Installed v${versionOrUnknown(updatedVersion)}`);
    log("");

    log(`🎉 Update complete! v${versionOrUnknown(currentInstalled)} → v${versionOrUnknown(updatedVersion)}`);
}

function listServers(): void {
    log("");
    log("🦞  Agent-Lock — Bundled MCP Servers");
    log("=".repeat(50));
    log("");

    const { configFile } = getInstallPaths();
    const currentConfig = readJson<Partial<MCPConfig>>(configFile, {});
    const currentServers = new Map<string, boolean>();
    for (const s of currentConfig.target_servers ?? []) {
        currentServers.set(s.name, s.enabled !== false);
    }

    for (const s of DEFAULT_SERVERS) {
        const activeEnabled = currentServers.has(s.name)
            ? currentServers.get(s.name)
            : s.enabled;
        const badge = activeEnabled ? "✅ ON " : "⭕ OFF";
        const needsConfig = !s.enabled ? " (needs config)" : "";
        log(`  ${badge}  ${s.label.padEnd(22)} — ${s.description}`);
        if (s.requires && !activeEnabled) {
            log(`         ↳ ${s.requires}`);
        }
    }

    log("");
    log(`Config file: ${configFile}`);
    log("To activate a server: edit the config and set \"enabled\": true");
    log("Then restart Claude Desktop.");
    log("");
}

function usage(): void {
    const v = getPackageVersion();
    log(`agent-lock-mcp v${v} — Governance gateway for Claude Desktop`);
    log("");
    log("Usage:");
    log("  npx @agentlock/mcp-server            Start MCP server (Claude Desktop)");
    log("  npx @agentlock/mcp-server setup      Install + auto-configure Claude Desktop");
    log("  npx @agentlock/mcp-server status     Show installation status");
    log("  npx @agentlock/mcp-server list-servers  Show bundled MCP servers + status");
    log("  npx @agentlock/mcp-server update     Update to latest version");
    log("");
    log("Commands:");
    log("  setup          One-shot install + Claude Desktop config patch");
    log("  serve          Start MCP server (stdio mode, default)");
    log("  list-servers   Show all bundled MCP servers and their on/off status");
    log("  status         Show status, versions, and connected servers");
    log("  update         Update npm package + reinstall MCP server");
    log("  add-server     Add a custom target MCP server");
    log("  config-path    Print path to mcp_config.json");
    log("  uninstall      Remove MCP server files (keeps config)");
    log("");
    log("Examples:");
    log("  npx @agentlock/mcp-server setup");
    log("  npx @agentlock/mcp-server list-servers");
    log("  npx @agentlock/mcp-server add-server filesystem npx \"-y @anthropic/mcp-server-filesystem /path\"");
    log("");
    log("  📖 https://github.com/edies76/agent-locker");
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main(): void {
    const args = process.argv.slice(2);
    const cmd = args[0];

    // Default: no args → serve in stdio mode (Claude Desktop calls with no args)
    if (!cmd) {
        serve("stdio");
        return;
    }

    if (cmd === "--help" || cmd === "-h") {
        usage();
        return;
    }

    switch (cmd) {
        case "setup":
            setup();
            break;
        case "install":
            install(false);
            break;
        case "serve":
        case "start": {
            let transport = "stdio";
            let port = 8001;
            for (let i = 1; i < args.length; i++) {
                if (args[i] === "--transport" && args[i + 1]) transport = args[++i];
                else if (args[i] === "--port" && args[i + 1]) port = parseInt(args[++i], 10);
            }
            serve(transport, port);
            break;
        }
        case "status":
            status();
            break;
        case "update":
            update();
            break;
        case "config-path":
            configPath();
            break;
        case "add-server": {
            const name = args[1];
            const command = args[2];
            const serverArgs = args.slice(3).join(" ");
            if (!name || !command) fail("Usage: add-server <name> <command> [args]");
            addServer(name, command, serverArgs);
            break;
        }
        case "list-servers":
            listServers();
            break;
        case "uninstall":
            uninstall();
            break;
        default:
            fail(`Unknown command: "${cmd}". Run with --help to see available commands.`);
    }
}

main();
