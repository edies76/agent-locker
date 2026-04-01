@echo off
setlocal

TITLE Agent-Lock MCP Runner
echo ================================================
echo        Agent-Lock MCP - Inicio rapido
echo ================================================
echo.

cd /d "%~dp0..\.."

if not exist ".mcp-venv\Scripts\activate.bat" (
  echo [ERROR] No existe .mcp-venv. Ejecuta primero installers\mcp\install-mcp.bat
  pause
  exit /b 1
)

call .mcp-venv\Scripts\activate.bat
if errorlevel 1 (
  echo [ERROR] No se pudo activar .mcp-venv.
  pause
  exit /b 1
)

echo Iniciando Agent-Lock MCP (stdio)...
echo Usa Ctrl+C para detener.
echo.
python mcp_launcher.py

pause
exit /b 0
