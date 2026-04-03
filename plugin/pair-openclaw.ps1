param(
  [string]$BackendUrl = "http://127.0.0.1:8000",
  [ValidateSet("agentlock_dashboard", "whatsapp", "telegram")]
  [string]$PreferredChannel = "agentlock_dashboard",
  [string]$Label = "OpenClaw"
)

$ErrorActionPreference = "Stop"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   Agent-Lock <-> OpenClaw Pairing (One Step)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$pairingUri = "$BackendUrl/dashboard/plugin/pairings"

Write-Host "[1/3] Requesting pairing token from backend..." -ForegroundColor Yellow
$payload = @{
  label = $Label
  preferred_channel = $PreferredChannel
} | ConvertTo-Json

$response = Invoke-RestMethod -Method POST -Uri $pairingUri -ContentType "application/json" -Body $payload

if (-not $response.ok -or -not $response.pairing.token) {
  throw "Could not create pairing token from backend at $pairingUri"
}

$token = [string]$response.pairing.token
Write-Host "      Token created." -ForegroundColor Green

Write-Host "[2/3] Writing OpenClaw plugin config..." -ForegroundColor Yellow
$configDir = Join-Path $env:USERPROFILE ".openclaw\extensions\agent-lock"
$configPath = Join-Path $configDir "agent-lock.config.json"

New-Item -ItemType Directory -Path $configDir -Force | Out-Null

$configObject = @{
  dashboard_bridge_token = $token
  preferred_channel = $PreferredChannel
  available_channels = @("agentlock_dashboard", "whatsapp", "telegram")
  client_label = "openclaw"
}

($configObject | ConvertTo-Json -Depth 4) | Set-Content -Path $configPath -Encoding UTF8
Write-Host "      Config saved at: $configPath" -ForegroundColor Green

Write-Host "[3/3] Done." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next step:" -ForegroundColor Cyan
Write-Host "  Restart OpenClaw gateway so it loads the new token:" -ForegroundColor White
Write-Host "  openclaw gateway" -ForegroundColor White
Write-Host ""
Write-Host "Then verify in dashboard:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000/plugin" -ForegroundColor White
Write-Host ""
