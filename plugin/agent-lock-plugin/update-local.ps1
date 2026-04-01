#!/usr/bin/env pwsh
# Local development update script for Agent-Lock plugin
# Auto-increments patch version and updates OpenClaw installation

Write-Host "🔧 Agent-Lock Local Development Update" -ForegroundColor Cyan
Write-Host ""

Set-Location "C:\nueva-carpeta\agent-lock\plugin\agent-lock-plugin"

# Step 1: Auto-version strategy
# Policy:
# - First run from any 1.0.x (or other branch) jumps to 1.1.1
# - Subsequent runs keep 1.1.x and increment patch: 1.1.2, 1.1.3, ...
Write-Host "📈 Auto-incrementing version..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$currentVersion = $packageJson.version
$versionParts = $currentVersion -split '\.'

if ($versionParts.Length -lt 3) {
    throw "Invalid semver in package.json: $currentVersion"
}

if ($versionParts[0] -ne "1" -or $versionParts[1] -ne "1") {
    $newVersion = "1.1.1"
} else {
    $versionParts[2] = [int]$versionParts[2] + 1
    $newVersion = $versionParts -join '.'
}

$packageJson.version = $newVersion
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8

# Keep openclaw.plugin.json in sync with package version
$pluginJson = Get-Content "openclaw.plugin.json" -Raw | ConvertFrom-Json
$pluginJson.version = $newVersion
$pluginJson | ConvertTo-Json -Depth 10 | Set-Content "openclaw.plugin.json" -Encoding UTF8

Write-Host "  $currentVersion → $newVersion" -ForegroundColor Green
Write-Host ""

# Step 2: Build the plugin
Write-Host "📦 Building plugin v$newVersion..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Copy to OpenClaw extensions
Write-Host "📋 Installing to OpenClaw..." -ForegroundColor Yellow
$targetDir = "$env:USERPROFILE\.openclaw\extensions\agent-lock"

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Copy-Item "dist\index.js" "$targetDir\index.js" -Force
Copy-Item "dist\cli.js" "$targetDir\cli.js" -Force
Copy-Item "openclaw.plugin.json" "$targetDir\openclaw.plugin.json" -Force
Copy-Item "package.json" "$targetDir\package.json" -Force

Write-Host ""
Write-Host "✅ Agent-Lock v$newVersion installed!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  RESTART OpenClaw gateway to load new version" -ForegroundColor Yellow
Write-Host ""

