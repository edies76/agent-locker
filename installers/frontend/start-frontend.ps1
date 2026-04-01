$Host.UI.RawUI.WindowTitle = "Agent-Lock Frontend Local"
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "     Iniciando Frontend (Dashboard) Agent-Lock     " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location (Join-Path $PSScriptRoot "..\..\dashboard")

if (-Not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm no esta disponible. Instala Node.js 18+ y vuelve a intentar." -ForegroundColor Red
    exit 1
}

if (-Not (Test-Path "node_modules")) {
    Write-Host "[1/2] Instalando dependencias del dashboard..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Fallo instalando dependencias." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[1/2] Dependencias detectadas." -ForegroundColor Green
}

Write-Host "[2/2] Iniciando frontend en http://localhost:3000 ..." -ForegroundColor Green
Write-Host "(Presiona CTRL+C para detener)" -ForegroundColor DarkGray
Write-Host ""

npm run dev
