#!/usr/bin/env pwsh
# Local development update script for Agent-Lock plugin
# Auto-increments patch version and updates OpenClaw installation

Write-Host "🔧 Agent-Lock Local Development Update" -ForegroundColor Cyan
Write-Host ""

Set-Location "C:\nueva-carpeta\agent-lock\plugin\agent-lock-plugin"

# Step 1: Auto-increment version
Write-Host "📈 Auto-incrementing version..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$currentVersion = $packageJson.version
$versionParts = $currentVersion -split '\.'
$versionParts[2] = [int]$versionParts[2] + 1
$newVersion = $versionParts -join '.'

$packageJson.version = $newVersion
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8

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

