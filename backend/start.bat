@echo off
title Ritasi App Server
color 0A
setlocal

REM ========================================
REM Set working directory ke lokasi BAT
REM ========================================
cd /d "%~dp0"

REM Ambil root folder (parent dari backend)
set ROOT_DIR=%cd%\..

echo ========================================
echo     RITASI APP - Starting Server
echo ========================================
echo.

REM ========================================
REM Check Node.js portable
REM ========================================
if not exist "%ROOT_DIR%\nodejs\node.exe" (
    echo ERROR: Node.js portable not found!
    echo Pastikan folder nodejs berada di root release
    echo.
    pause
    exit /b
)

REM ========================================
REM Install dependencies jika perlu
REM ========================================
if not exist "node_modules" (
    echo Installing dependencies...
    "%ROOT_DIR%\nodejs\node.exe" "%ROOT_DIR%\nodejs\node_modules\npm\bin\npm-cli.js" install --omit=dev
    echo.
)

REM ========================================
REM Start server
REM ========================================
echo Starting server...
echo Server will run at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

"%ROOT_DIR%\nodejs\node.exe" server.js

pause
