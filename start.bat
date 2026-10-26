@echo off
rem Radio-Dashboard starten (Windows). Benötigt Python 3.8 oder neuer: https://www.python.org/downloads/
cd /d "%~dp0"
set PY=python
where python >nul 2>nul || set PY=py -3
where python >nul 2>nul || where py >nul 2>nul || goto :nopython
%PY% server.py %*
pause
exit /b

:nopython
echo Python wurde nicht gefunden. Bitte Python 3 installieren: https://www.python.org/downloads/
echo Bei der Installation "Add python.exe to PATH" anhaken und danach start.bat erneut starten.
pause
exit /b 1
