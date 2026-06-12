@echo off
title Restore original highway screen.js (remove bridge)
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator rights...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
set "TARGET=C:\Program Files\Slopsmith\current\resources\slopsmith\plugins\highway_3d\screen.js"
if exist "%TARGET%.bak" (
  copy /Y "%TARGET%.bak" "%TARGET%" >nul
  del "%TARGET%.bak" >nul
  echo [OK] Original renderer restored.
) else (
  echo No backup (.bak) found to restore.
)
echo.
pause
