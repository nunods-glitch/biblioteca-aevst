@echo off
title Biblioteca AEVST - Servidor Local
cd /d "%~dp0"

echo ========================================================
echo   BIBLIOTECA AEVST - Gestao de Espacos
echo ========================================================
echo A iniciar a aplicacao...
echo Por favor nao feche esta janela enquanto estiver a usar.
echo.

if not exist "node_modules" (
    echo A instalar dependencias pela primeira vez...
    call npm install
)

start "" "http://localhost:3000"
call npm run dev
pause
