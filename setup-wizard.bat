@echo off
SETLOCAL

echo Medicine Man - Setup Wizard
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed.
    echo Please install Node.js to continue.
    exit /b 1
)

:: Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: npm is not installed.
    echo Please install npm to continue.
    exit /b 1
)

:: Get script directory
set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%backend

:: Check if backend directory exists
if not exist "%BACKEND_DIR%" (
    echo Error: Backend directory not found.
    echo Please run this script from the Medicine Man root directory.
    exit /b 1
)

:: Check if node_modules exists
if not exist "%BACKEND_DIR%\node_modules" (
    echo Installing dependencies...
    cd "%BACKEND_DIR%"
    call npm install
    echo.
)

:: Run the setup wizard
cd "%BACKEND_DIR%"
echo Starting setup wizard...
echo.
node src\scripts\setup-wizard.js

ENDLOCAL
exit /b 0
