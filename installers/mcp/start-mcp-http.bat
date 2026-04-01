@echo off
setlocal

TITLE Agent-Lock MCP HTTP Runner
echo ================================================
echo      Agent-Lock MCP - Modo HTTP (testing)
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

echo Iniciando Agent-Lock MCP en HTTP (puerto 8001)...
echo Endpoint SSE esperado: http://localhost:8001/sse
echo Usa Ctrl+C para detener.
echo.
python -m mcp_server --transport http --port 8001

pause
exit /b 0
