#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync, spawn, ChildProcess } from "node:child_process";

// ── Constants ────────────────────────────────────────────────────────────────
const PACKAGE_NAME = "@agentlock/mcp-server";
const OFFICIAL_BACKEND_URL = "https://agent-lock-backend-api-7.azurewebsites.net";
const LOCAL_BACKEND_URL = "http://localhost:8000";
const NPM_LOOKUP_TIMEOUT_MS = Number(process.env.AGENT_LOCK_NPM_LOOKUP_TIMEOUT_MS ?? "30000");
const NPM_INSTALL_TIMEOUT_MS = Number(process.env.AGENT_LOCK_NPM_INSTALL_TIMEOUT_MS ?? "300000");

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
    const result = spawnSync(pythonCmd, ["-c", "import mcp, httpx, pydantic"], {
        encoding: "utf8",
        shell: process.platform === "win32",
    });
    return result.status === 0;
}

// ── Commands ─────────────────────────────────────────────────────────────────
function install(): void {
    const version = getPackageVersion();
    log(`📦 Installing Agent-Lock MCP Server v${version}...`);

    const { configDir, configFile, pythonDir } = getInstallPaths();
    const python = checkPython();

    if (!python.available) {
        fail("Python 3.8+ is required. Install Python and try again.");
    }
    log(`   Python: ${python.command}`);

    // Copy Python MCP server files
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
    log(`   Copied MCP server to: ${pythonDir}`);

    // Check/install Python dependencies
    if (!checkPythonDeps(python.command)) {
        log("   Installing Python dependencies...");
        const pipResult = spawnSync(python.command, ["-m", "pip", "install", "--quiet", "mcp", "httpx", "pydantic", "pydantic-settings"], {
            stdio: "inherit",
            shell: process.platform === "win32",
        });
        if (pipResult.status !== 0) {
            log("⚠️  Could not auto-install Python deps. Run manually:");
            log(`   ${python.command} -m pip install mcp httpx pydantic pydantic-settings`);
        }
    }

    // Create default config if not exists
    if (!fs.existsSync(configFile)) {
        const defaultConfig: MCPConfig = {
            target_servers: [
                // Example servers (commented in description)
            ],
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
        log(`   Created config: ${configFile}`);
    } else {
        log(`   Config exists: ${configFile}`);
    }

    log("");
    log("✅ Agent-Lock MCP Server installed!");
    log("");
    log("📝 Next steps:");
    log(`   1) Edit config: ${configFile}`);
    log("   2) Add your target MCP servers");
    log("   3) Run: agent-lock-mcp start");
    log("");
    log("For Claude Desktop, add to claude_desktop_config.json:");
    log(`   "agent-lock": {`);
    log(`     "command": "agent-lock-mcp",`);
    log(`     "args": ["serve"]`);
    log(`   }`);
}

function status(): void {
    const { configDir, configFile, pythonDir } = getInstallPaths();
    const version = getPackageVersion();
    const installedVersion = getInstalledVersion();
    const globalVersion = getGlobalInstalledVersion();
    const latestVersion = getLatestPublishedVersion();
    const python = checkPython();
    const configExists = fs.existsSync(configFile);
    const pythonExists = fs.existsSync(path.join(pythonDir, "server.py"));

    log(`🦞 Agent-Lock MCP Server`);
    log("");
    log(`package_version:   v${version}`);
    log(`global_version:    v${versionOrUnknown(globalVersion)}`);
    log(`installed_version: v${versionOrUnknown(installedVersion)}`);
    log(`npm_latest:        v${versionOrUnknown(latestVersion)}`);
    log("");
    log(`installed:         ${pythonExists}`);
    log(`config_exists:     ${configExists}`);
    log(`config_path:       ${configFile}`);
    log(`python_path:       ${pythonDir}`);
    log(`python_cmd:        ${python.available ? `${python.command} (${python.version})` : "(not found)"}`);
    log(`backend_url:       ${OFFICIAL_BACKEND_URL}`);
    log(`local_backend:     ${LOCAL_BACKEND_URL}`);

    if (configExists) {
        const config = readJson<Partial<MCPConfig>>(configFile, {});
        log("");
        log("Config:");
        log(`  target_servers: ${config.target_servers?.length ?? 0}`);
        for (const srv of config.target_servers ?? []) {
            log(`    - ${srv.name}: ${srv.command} ${(srv.args ?? []).join(" ")} ${srv.enabled === false ? "(disabled)" : ""}`);
        }
        log(`  backend_url:    ${config.backend_url ?? "(default)"}`);
        log(`  subject_token:  ${config.subject_token ? "(set)" : "(not set)"}`);
    }

    log("");
    if (pythonExists && python.available) {
        if (latestVersion && globalVersion && compareSemver(globalVersion, latestVersion) < 0) {
            log(`⚠️  Update available: v${globalVersion} -> v${latestVersion}`);
            log("   Run: agent-lock-mcp update");
        } else {
            log("🎉 Ready to use. Run: agent-lock-mcp serve");
        }
    } else if (!pythonExists) {
        log("⚠️  MCP server not installed. Run: agent-lock-mcp install");
    } else {
        log("⚠️  Python not found. Install Python 3.8+");
    }
}

function serve(transport: string = "stdio", port: number = 8001): void {
    const { pythonDir, configFile } = getInstallPaths();
    const python = checkPython();
    const version = getInstalledVersion() || getPackageVersion();

    if (!python.available) {
        fail("Python not found. Install Python 3.8+");
    }

    const serverPy = path.join(pythonDir, "server.py");
    if (!fs.existsSync(serverPy)) {
        fail("MCP server not installed. Run: agent-lock-mcp install");
    }

    log(`🦞 Starting Agent-Lock MCP Server v${version}`);
    log(`   Transport: ${transport}`);
    log(`   Config:    ${configFile}`);
    log(`   Python:    ${python.command} (${python.version})`);
    log("");


    const args = ["-m", "mcp_server"];
    if (transport !== "stdio") {
        args.push("--transport", transport, "--port", String(port));
    }
    args.push("--config", configFile);

    // For stdio, we need to run in the python dir and pass through stdin/stdout
    const serverProcess = spawn(python.command, args, {
        cwd: path.dirname(pythonDir),
        stdio: transport === "stdio" ? "inherit" : ["ignore", "inherit", "inherit"],
        shell: process.platform === "win32",
        env: {
            ...process.env,
            PYTHONPATH: path.dirname(pythonDir),
        },
    });

    serverProcess.on("error", (err) => {
        fail(`Failed to start server: ${err.message}`);
    });

    if (transport !== "stdio") {
        log(`   Server running on port ${port}`);
        log("   Press Ctrl+C to stop");
    }
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
    config.target_servers.push({
        name,
        command,
        args,
        enabled: true,
    });

    writeJson(configFile, config);
    log(`✅ Added server: ${name}`);
    log(`   Command: ${command} ${args.join(" ")}`);
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
    log("✅ Agent-Lock MCP Server uninstalled");
    log(`   Previous version: v${versionOrUnknown(version)}`);
    log(`   Config preserved at: ${configFile}`);
}

function getGlobalInstalledVersion(): string | null {
    const result = spawnSync("npm", ["list", "-g", PACKAGE_NAME, "--depth=0", "--json"], {
        encoding: "utf8",
        shell: process.platform === "win32",
        timeout: NPM_LOOKUP_TIMEOUT_MS,
    });
    if ((result.status ?? 1) !== 0 || !result.stdout) return null;
    try {
        const parsed = JSON.parse(result.stdout) as {
            dependencies?: Record<string, { version?: string }>;
        };
        return parsed.dependencies?.[PACKAGE_NAME]?.version ?? null;
    } catch {
        return null;
    }
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

function hasMcpServerInstalled(): boolean {
    const { pythonDir } = getInstallPaths();
    return fs.existsSync(path.join(pythonDir, "server.py"));
}

function update(): void {
    const currentGlobal = getGlobalInstalledVersion();
    const currentInstalled = getInstalledVersion();
    const latest = getLatestPublishedVersion();

    log("🔄 Agent-Lock MCP Server update started");
    log(`   Global (npm) version:   v${versionOrUnknown(currentGlobal)}`);
    log(`   Installed version:      v${versionOrUnknown(currentInstalled)}`);
    log(`   npm latest:             v${versionOrUnknown(latest)}`);
    log("");

    // Step 1: Uninstall current
    log("1) Removing current MCP server installation...");
    try {
        const { pythonDir } = getInstallPaths();
        if (fs.existsSync(pythonDir)) {
            fs.rmSync(pythonDir, { recursive: true, force: true });
        }
        log("✅ Step 1 complete: Old installation removed");
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        fail(`❌ Step 1 failed: ${msg}`);
    }
    log("");

    // Step 2: Update global npm package
    log("2) Installing latest global package (@agentlock/mcp-server@latest)...");
    const npmResult = spawnSync("npm", ["i", "-g", `${PACKAGE_NAME}@latest`], {
        stdio: "inherit",
        shell: process.platform === "win32",
        timeout: NPM_INSTALL_TIMEOUT_MS,
    });
    if (npmResult.error) {
        fail(`❌ Step 2 failed (npm install): ${npmResult.error.message}`);
    }
    if ((npmResult.status ?? 1) !== 0) {
        fail("❌ Step 2 failed (npm install). Try manually: npm i -g @agentlock/mcp-server@latest");
    }
    const updatedGlobal = getGlobalInstalledVersion();
    log(`✅ Step 2 complete: Global now v${versionOrUnknown(updatedGlobal)}`);
    log("");

    // Step 3: Reinstall MCP server with new CLI
    log("3) Reinstalling MCP server with updated CLI...");
    const installResult = spawnSync("agent-lock-mcp", ["install"], {
        stdio: "inherit",
        shell: process.platform === "win32",
    });
    if (installResult.error) {
        fail(`❌ Step 3 failed (install): ${installResult.error.message}`);
    }
    if ((installResult.status ?? 1) !== 0) {
        fail("❌ Step 3 failed. Run manually: agent-lock-mcp install");
    }
    const updatedInstalled = getInstalledVersion();
    log(`✅ Step 3 complete: Installed v${versionOrUnknown(updatedInstalled)}`);
    log("");

    // Step 4: Verification
    log("4) Verification summary");
    log(`   Global:    v${versionOrUnknown(currentGlobal)} -> v${versionOrUnknown(updatedGlobal)}`);
    log(`   Installed: v${versionOrUnknown(currentInstalled)} -> v${versionOrUnknown(updatedInstalled)}`);
    
    if (latest && updatedGlobal) {
        const cmp = compareSemver(updatedGlobal, latest);
        if (cmp < 0) {
            log(`⚠️  Installed below latest (v${updatedGlobal} < v${latest})`);
        } else {
            log(`✅ Aligned with npm latest (v${latest})`);
        }
    }

    log("");
    log("🎉 Update completed successfully!");
}

function compareSemver(a: string, b: string): number {
    const parse = (v: string): number[] => {
        const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
    };
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 3; i++) {
        if (pa[i] > pb[i]) return 1;
        if (pa[i] < pb[i]) return -1;
    }
    return 0;
}

function usage(): void {
    log("agent-lock-mcp <command>");
    log("");
    log("Commands:");
    log("  install                Install MCP server and create default config");
    log("  status                 Show installation status and config");
    log("  serve [--transport T]  Start MCP server (stdio|http, default: stdio)");
    log("  update                 Update to latest version (global + local)");
    log("  config-path            Print config file path");
    log("  add-server <name> <cmd> [args]  Add a target MCP server");
    log("  uninstall              Remove MCP server (keeps config)");
    log("");
    log("Examples:");
    log("  agent-lock-mcp install");
    log("  agent-lock-mcp serve");
    log("  agent-lock-mcp update");
    log("  agent-lock-mcp serve --transport http --port 8001");
    log("  agent-lock-mcp add-server filesystem npx '-y @anthropic/mcp-server-filesystem /path'");
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main(): void {
    const args = process.argv.slice(2);
    const cmd = args[0];

    if (!cmd || cmd === "--help" || cmd === "-h") {
        usage();
        return;
    }

    switch (cmd) {
        case "install":
            install();
            break;
        case "status":
            status();
            break;
        case "serve":
        case "start": {
            let transport = "stdio";
            let port = 8001;
            for (let i = 1; i < args.length; i++) {
                if (args[i] === "--transport" && args[i + 1]) {
                    transport = args[++i];
                } else if (args[i] === "--port" && args[i + 1]) {
                    port = parseInt(args[++i], 10);
                }
            }
            serve(transport, port);
            break;
        }
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
            if (!name || !command) {
                fail("Usage: agent-lock-mcp add-server <name> <command> [args]");
            }
            addServer(name, command, serverArgs);
            break;
        }
        case "uninstall":
            uninstall();
            break;
        default:
            fail(`Unknown command: ${cmd}. Run 'agent-lock-mcp --help'`);
    }
}

main();
