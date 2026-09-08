@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" (
  echo ERROR: Copy .env.example to .env and fill your private Supabase values first.
  pause
  exit /b 1
)
if not exist "backend\package.json" (
  echo ERROR: Open this file from the extracted BISIS project root.
  pause
  exit /b 1
)
echo Starting BISIS backend on http://127.0.0.1:5000
npm --prefix backend run dev
pause
