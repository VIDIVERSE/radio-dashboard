@echo off
rem Setzt das Passwort des Haupt-Administrators zurück (Server vorher beenden).
cd /d "%~dp0"
python server.py --passwort
