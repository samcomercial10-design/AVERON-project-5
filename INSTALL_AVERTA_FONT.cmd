@echo off
setlocal
if "%~1"=="" (
  echo Drag your licensed "Averta PE Regular.otf" file onto this script,
  echo or run:
  echo INSTALL_AVERTA_FONT.cmd "C:\path\Averta PE Regular.otf"
  pause
  exit /b 1
)
if not exist "%~1" (
  echo Font file not found: %~1
  pause
  exit /b 1
)
if not exist "%~dp0assets\fonts" mkdir "%~dp0assets\fonts"
copy /Y "%~1" "%~dp0assets\fonts\AvertaPE-Regular.otf" >nul
if errorlevel 1 (
  echo Could not copy the font file.
  pause
  exit /b 1
)
echo Averta PE Regular installed into the AVERON project successfully.
echo Refresh the browser with Ctrl+F5.
pause
