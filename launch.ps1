# Agent-Lock Unified Launcher
# Este script arranca el Backend y OpenClaw con el plugin ya configurado.

$RootPath = Get-Location
$BackendPath = "$RootPath\backend"
$PluginPath = "$RootPath\plugin\agent-lock-plugin"

Write-Host "🦞 Iniciando Agent-Lock Ecosystem..." -ForegroundColor Cyan

# 1. Verificar/Compilar Plugin
if (!(Test-Path "$PluginPath\dist")) {
    Write-Host "📦 Compilando plugin por primera vez..." -ForegroundColor Yellow
    Set-Location $PluginPath
    npm install
    npm run build
    Set-Location $RootPath
}

# 2. Iniciar Backend en una ventana separada
Write-Host "🚀 Arrancando Backend en background..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $BackendPath; .\venv\Scripts\activate; python main.py"

# 3. Configurar Plugin para OpenClaw
Write-Host "🔌 Conectando plugin con OpenClaw..." -ForegroundColor Green
$env:OPENCLAW_PLUGINS_PATH = $PluginPath

# 4. Lanzar OpenClaw
Write-Host "🦞 Lanzando OpenClaw..." -ForegroundColor Cyan
openclaw
