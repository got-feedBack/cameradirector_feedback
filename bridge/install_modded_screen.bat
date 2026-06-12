@echo off
title Install modded highway screen.js (Camera Director bridge)
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator rights...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
set "TARGET=C:\Program Files\Slopsmith\current\resources\slopsmith\plugins\highway_3d\screen.js"
set "SRC=%~dp0screen.js"
echo.
echo ============================================================
echo  Camera Director bridge  -^>  Slopsmith Desktop (highway_3d)
echo ============================================================
echo.
echo Target:
echo   %TARGET%
echo.
tasklist /FI "IMAGENAME eq Slopsmith.exe" 2>nul | find /I "Slopsmith.exe" >nul
if %errorlevel% equ 0 (
  echo [WARNING] Slopsmith appears to be RUNNING. Close it and run this again.
  echo.
  pause
  exit /b 1
)
if not exist "%TARGET%" (
  echo [ERROR] Could not find the highway renderer in the installation.
  echo Check that Slopsmith is installed in C:\Program Files\Slopsmith
  echo If it lives elsewhere, edit the TARGET line in this script.
  echo.
  pause
  exit /b 1
)
if not exist "%TARGET%.bak" (
  copy /Y "%TARGET%" "%TARGET%.bak" >nul
  echo Backup created: screen.js.bak
) else (
  echo Backup already existed, keeping the original.
)
copy /Y "%SRC%" "%TARGET%" >nul
if %errorlevel% equ 0 (
  echo.
  echo [OK] Bridge installed successfully.
  echo Open Slopsmith: Camera Director should now move the camera.
) else (
  echo.
  echo [ERROR] Copy failed. Make sure Slopsmith is CLOSED.
)
echo.
pause
