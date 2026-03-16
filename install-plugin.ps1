# Agent-Lock Installer
# Installs the plugin directly into OpenClaw's native extensions folder

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$PluginDir = Join-Path $Root "plugin\agent-lock-plugin"
$Dest = "$env:USERPROFILE\.openclaw\extensions\agent-lock"
$OpenClawJson = "$env:USERPROFILE\.openclaw\openclaw.json"

Write-Host ""
Write-Host "🦞 Agent-Lock Installer" -ForegroundColor Cyan
Write-Host "──────────────────────────────────" -ForegroundColor DarkGray

# 1. Build
Write-Host "📦 Compiling TypeScript..." -ForegroundColor Yellow
Set-Location $PluginDir
npm run build | Out-Null
Write-Host "   ✅ Build completed" -ForegroundColor Green

# 2. Install into OpenClaw extensions
Write-Host "📁 Copying to local extensions..." -ForegroundColor Yellow
if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force | Out-Null }
New-Item -ItemType Directory -Path $Dest -Force | Out-Null

Copy-Item "$PluginDir\dist\index.js"          "$Dest\index.js" -Force
Copy-Item "$PluginDir\openclaw.plugin.json"   "$Dest\openclaw.plugin.json" -Force
Copy-Item "$PluginDir\package.json"           "$Dest\package.json" -Force
Write-Host "   ✅ Installed in $Dest" -ForegroundColor Green

# 3. Register in openclaw.json
Write-Host "⚙️  Registering in openclaw.json..." -ForegroundColor Yellow
if (!(Test-Path $OpenClawJson)) {
    Write-Host "   ⚠️ openclaw.json not found at $OpenClawJson. Skipping registration." -ForegroundColor Red
} else {
    $config = Get-Content $OpenClawJson -Raw | ConvertFrom-Json

    # Validate / Ensure plugins section
    if (-not $config.PSObject.Properties.Match("plugins").Count) {
        $config | Add-Member -MemberType NoteProperty -Name "plugins" -Value ([PSCustomObject]@{ allow = @(); entries = @{} }) -Force
    }
    else {
        if (-not $config.plugins.PSObject.Properties.Match("allow").Count) {
            $config.plugins | Add-Member -MemberType NoteProperty -Name "allow" -Value @() -Force
        }
        if (-not $config.plugins.PSObject.Properties.Match("entries").Count) {
            $config.plugins | Add-Member -MemberType NoteProperty -Name "entries" -Value ([PSCustomObject]@{}) -Force
        }
    }

    # Enable plugin
    $allowed = @($config.plugins.allow)
    if ($allowed -notcontains "agent-lock") {
        $config.plugins.allow = $allowed + "agent-lock"
    }
    $config.plugins.entries | Add-Member -MemberType NoteProperty -Name "agent-lock" -Value ([PSCustomObject]@{ enabled = $true }) -Force

    $config | ConvertTo-Json -Depth 15 | Set-Content $OpenClawJson -Encoding UTF8
    Write-Host "   ✅ OpenClaw configuration updated" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Agent-Lock configured correctly. Restart OpenClaw:" -ForegroundColor Cyan
Write-Host "   openclaw restart" -ForegroundColor White
Write-Host ""
