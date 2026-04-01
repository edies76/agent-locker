@echo off
setlocal

TITLE Agent-Lock Frontend Local

echo ===================================================
echo      Iniciando Frontend (Dashboard) Agent-Lock
echo ===================================================
echo.

cd /d "%~dp0..\..\dashboard"

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm no esta disponible. Instala Node.js 18+ y vuelve a intentar.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/2] Instalando dependencias del dashboard...
    npm install
    if errorlevel 1 (
        echo [ERROR] Fallo instalando dependencias.
        pause
        exit /b 1
    )
) else (
    echo [1/2] Dependencias detectadas.
)

echo [2/2] Iniciando frontend en http://localhost:3000 ...
echo (Presiona CTRL+C para detener)
echo.

npm run dev

pause
