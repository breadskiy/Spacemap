@echo off
title SpaceMap - Launching Project
cd /d "%~dp0"

echo ===================================================
echo   SpaceMap 2D CAD & Indoor Navigation System
echo ===================================================
echo.

rem 1. Проверяем и запускаем PostgreSQL
if exist "D:\PostgreSQL\bin\pg_ctl.exe" (
    "D:\PostgreSQL\bin\pg_ctl.exe" status -D "D:\PostgreSQL\data" >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [1/3] Запуск базы данных PostgreSQL...
        "D:\PostgreSQL\bin\pg_ctl.exe" start -D "D:\PostgreSQL\data" -w >nul 2>&1
    ) else (
        echo [1/3] База данных PostgreSQL уже запущена.
    )
)

rem 2. Запускаем FastAPI Backend в отдельном окне
echo [2/3] Запуск Backend API сервера (http://localhost:8000)...
start "SpaceMap Backend (FastAPI)" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --reload --port 8000"

rem 3. Запускаем Frontend веб-сервер и открываем браузер
echo [3/3] Запуск Frontend веб-приложения (http://localhost:5173)...
echo.
echo ===================================================
echo   Проект успешно запущен!
echo   Веб-интерфейс: http://localhost:5173
echo   Swagger API:   http://localhost:8000/docs
echo ===================================================
echo.

cd /d "%~dp0frontend"
start http://localhost:5173
npm run dev
