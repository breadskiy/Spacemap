@echo off
title SpaceMap FastAPI Backend
cd /d "%~dp0"

echo ===================================================
echo   SpaceMap 2D CAD Backend Server
echo ===================================================
echo.

rem Проверяем статус PostgreSQL и запускаем при необходимости
if exist "D:\PostgreSQL\bin\pg_ctl.exe" (
    "D:\PostgreSQL\bin\pg_ctl.exe" status -D "D:\PostgreSQL\data" >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [SpaceMap] Запуск локального PostgreSQL...
        "D:\PostgreSQL\bin\pg_ctl.exe" start -D "D:\PostgreSQL\data" -w >nul 2>&1
    )
)

echo [SpaceMap] Запуск FastAPI API сервера...
echo [SpaceMap] Swagger UI: http://localhost:8000/docs
echo.

python -m uvicorn main:app --reload --port 8000

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Server stopped with error.
    pause
)
