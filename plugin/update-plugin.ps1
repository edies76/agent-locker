# Update Agent-Lock Plugin for OpenClaw
# Run this after making changes to the plugin

Write-Host "🔄 Updating Agent-Lock plugin for OpenClaw..." -ForegroundColor Cyan

# Build the plugin
Write-Host "`n📦 Building plugin..." -ForegroundColor Yellow
Set-Location "C:\nueva-carpeta\agent-lock\plugin\agent-lock-plugin"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Copy to OpenClaw extensions
Write-Host "`n📋 Copying to OpenClaw..." -ForegroundColor Yellow
$targetDir = "C:\Users\ediva\.openclaw\extensions\agent-lock"

Copy-Item "dist\index.js" "$targetDir\index.js" -Force
Copy-Item "dist\cli.js" "$targetDir\cli.js" -Force
Copy-Item "openclaw.plugin.json" "$targetDir\openclaw.plugin.json" -Force
Copy-Item "package.json" "$targetDir\package.json" -Force

Write-Host "`n✅ Plugin updated successfully!" -ForegroundColor Green
Write-Host "`n⚠️  IMPORTANT: Restart OpenClaw gateway to load the new plugin:" -ForegroundColor Yellow
Write-Host "   1. Stop current gateway (Ctrl+C)" -ForegroundColor White
Write-Host "   2. Run: openclaw gateway" -ForegroundColor White
Write-Host "`n📝 New tools available:" -ForegroundColor Cyan
Write-Host "   - agent_lock_gmail_send" -ForegroundColor White
Write-Host "   - agent_lock_github_create_issue" -ForegroundColor White
Write-Host "   - agent_lock_slack_send" -ForegroundColor White
Write-Host "   - agent_lock_calendar_create" -ForegroundColor White
