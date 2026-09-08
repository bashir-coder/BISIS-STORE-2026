@echo off
setlocal
cd /d "%~dp0"
if not exist "frontend\package.json" (
  echo ERROR: Open this file from the extracted BISIS project root.
  pause
  exit /b 1
)
echo Starting BISIS frontend on http://127.0.0.1:3000
npm --prefix frontend run dev -- --host 127.0.0.1 --port 3000
pause
