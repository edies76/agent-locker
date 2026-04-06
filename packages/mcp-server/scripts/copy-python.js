#!/usr/bin/env node

/**
 * Copies Python MCP server files to the package's python/ directory.
 * Run during prepack to bundle Python code with npm package.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const MCP_SERVER_SRC = path.join(ROOT, "mcp_server");
const DEST = path.join(__dirname, "..", "python");

const PY_FILES = [
    "__init__.py",
    "__main__.py",
    "config.py",
    "proxy.py",
    "server.py",
    "validator.py",
    "setup_wizard.py",
];

function main() {
    console.log("[copy-python] Copying Python MCP server files...");
    console.log(`  Source: ${MCP_SERVER_SRC}`);
    console.log(`  Dest:   ${DEST}`);

    // Create destination directory
    fs.mkdirSync(DEST, { recursive: true });

    let copied = 0;
    for (const file of PY_FILES) {
        const src = path.join(MCP_SERVER_SRC, file);
        const dst = path.join(DEST, file);

        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dst);
            console.log(`  ✓ ${file}`);
            copied++;
        } else {
            console.log(`  ⚠ ${file} (not found)`);
        }
    }

    console.log(`[copy-python] Done. Copied ${copied}/${PY_FILES.length} files.`);
}

main();
