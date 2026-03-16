# Agent-Lock Unified Launcher
# This script starts the Backend and OpenClaw with the plugin pre-configured.

$RootPath = Get-Location
$BackendPath = "$RootPath\backend"
$PluginPath = "$RootPath\plugin\agent-lock-plugin"

Write-Host "🦞 Starting Agent-Lock Ecosystem..." -ForegroundColor Cyan

# 1. Verify/Build Plugin
if (!(Test-Path "$PluginPath\dist")) {
    Write-Host "📦 Building plugin for the first time..." -ForegroundColor Yellow
    Set-Location $PluginPath
    npm install
    npm run build
    Set-Location $RootPath
}

# 2. Start Backend in a separate window
Write-Host "🚀 Launching Backend in separate process..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $BackendPath; .\venv\Scripts\activate; python main.py"

# 3. Configure Plugin for OpenClaw
Write-Host "🔌 Connecting plugin with OpenClaw..." -ForegroundColor Green
$env:OPENCLAW_PLUGINS_PATH = $PluginPath

# 4. Launch OpenClaw
Write-Host "🦞 Launching OpenClaw..." -ForegroundColor Cyan
openclaw
