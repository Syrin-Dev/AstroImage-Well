@echo off
echo ===========================================
echo       AstroImage Well - Installer
echo ===========================================
echo.

echo 1. Checking for Python...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Python command not found. Trying 'py'...
    where py >nul 2>nul
    if %errorlevel% neq 0 (
         echo Error: Python is not found in PATH.
         echo Please install Python 3.9+ from python.org and "Add to PATH".
         pause
         exit /b 1
    )
    set PYCMD=py
) else (
    set PYCMD=python
)

echo Using Python: %PYCMD%
echo.

echo 2. Upgrading Pip...
%PYCMD% -m pip install --upgrade pip
echo.

echo 3. Installing Dependencies (this may take a minute)...
%PYCMD% -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    echo ERROR: Failed to install requirements.
    echo Please check your internet connection or permissions.
    echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    pause
    exit /b %errorlevel%
)

echo.
echo 4. Starting Application...
echo Open http://127.0.0.1:5000 in your browser.
echo.
%PYCMD% app.py
pause
