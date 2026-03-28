$Host.UI.RawUI.WindowTitle = "Agent-Lock Backend Local"
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "      Iniciando Backend Local de Agent-Lock        " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location .\backend

# Verify if Python virtual environment exists
if (-Not (Test-Path "venv\Scripts\activate.ps1")) {
    Write-Host "[1/3] Entorno virtual no encontrado. Creando entorno pip (venv)..." -ForegroundColor Yellow
    python -m venv venv
    
    Write-Host "[2/3] Instalando dependencias requeridas..." -ForegroundColor Yellow
    & ".\venv\Scripts\Activate.ps1"
    pip install -r requirements.txt
} else {
    Write-Host "[1/3] Entorno virtual detectado." -ForegroundColor Green
    & ".\venv\Scripts\Activate.ps1"
    Write-Host "[2/3] Dependencias listas." -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/3] Arrancando el servidor local de Uvicorn en el puerto 8000..." -ForegroundColor Green
Write-Host "(Presiona CTRL+C para detener el servidor)" -ForegroundColor DarkGray
Write-Host ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
