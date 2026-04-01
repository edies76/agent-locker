@echo off
setlocal

TITLE Agent-Lock MCP Installer
echo ================================================
echo        Agent-Lock MCP - Instalador rapido
echo ================================================
echo.

cd /d "%~dp0..\.."

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python no esta instalado o no esta en PATH.
  echo Instala Python 3.10+ y vuelve a ejecutar este instalador.
  pause
  exit /b 1
)

if not exist ".mcp-venv\Scripts\activate.bat" (
  echo [1/4] Creando entorno virtual para MCP...
  python -m venv .mcp-venv
  if errorlevel 1 (
    echo [ERROR] No se pudo crear el entorno virtual.
    pause
    exit /b 1
  )
) else (
  echo [1/4] Entorno virtual MCP ya existe.
)

call .mcp-venv\Scripts\activate.bat
if errorlevel 1 (
  echo [ERROR] No se pudo activar el entorno virtual.
  pause
  exit /b 1
)

echo [2/4] Instalando dependencias de Python...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] Fallo instalando dependencias.
  pause
  exit /b 1
)

echo [3/4] Preparando carpeta de configuracion MCP...
if not exist "%USERPROFILE%\.agent-lock" mkdir "%USERPROFILE%\.agent-lock"

if not exist "%USERPROFILE%\.agent-lock\mcp_config.json" (
  echo [4/4] Creando mcp_config.json inicial apuntando a Azure...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$cfg = @{ backend_url = 'https://agent-lock-backend-api-7.azurewebsites.net'; auto_approve_low_risk = $true; require_approval_for_high = $true; require_approval_for_critical = $true; approval_timeout_seconds = 300; target_servers = @() } | ConvertTo-Json -Depth 6; Set-Content -Path \"$env:USERPROFILE\.agent-lock\mcp_config.json\" -Value $cfg -Encoding UTF8"
) else (
  echo [4/4] mcp_config.json ya existe. No se sobrescribio.
)

echo.
echo Instalacion lista.
echo Siguiente paso:
echo 1) Edita %USERPROFILE%\.agent-lock\mcp_config.json y agrega target_servers.
echo 2) Ejecuta installers\mcp\start-mcp.bat para iniciar Agent-Lock MCP.
echo.
pause
exit /b 0
