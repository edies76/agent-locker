@echo off
TITLE Agent-Lock Backend Local
echo ===================================================
echo       Iniciando Backend Local de Agent-Lock
echo ===================================================
echo.

cd backend

:: Verificar si el entorno virtual existe
if not exist "venv\Scripts\activate.bat" (
    echo [1/3] Entorno virtual no encontrado. Creando entorno pip (venv)...
    python -m venv venv
    
    echo [2/3] Instalando dependencias requeridas...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    echo [1/3] Entorno virtual detectado.
    call venv\Scripts\activate.bat
    echo [2/3] Dependencias listas.
)

echo.
echo [3/3] Arrancando el servidor local de Uvicorn en el puerto 8000...
echo (Presiona CTRL+C para detener el servidor)
echo.

uvicorn main:app --host 0.0.0.0 --port 8000 --reload

pause
