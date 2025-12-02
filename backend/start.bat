@echo off
title Ritasi App Server
color 0A
cd /d "%~dp0"

echo ========================================
echo     RITASI APP - Starting Server
echo ========================================
echo.

REM Check if nodejs folder exists
if not exist "..\nodejs\node.exe" (
    echo ERROR: Node.js portable not found!
    echo Please extract nodejs folder to parent directory
    echo.
    pause
    exit
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    ..\nodejs\node.exe ..\nodejs\node_modules\npm\bin\npm-cli.js install --omit=dev
    echo.
)

echo Starting server...
echo Server will run at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start server (browser akan dibuka otomatis oleh server.js setelah DB connected)
..\nodejs\node.exe server.js

pause