@echo off
rem Double-click to run A10 Hospital: starts MySQL and the website.
rem Close this window or press Ctrl+C to stop.
cd /d "%~dp0"
start "" http://localhost:3000
npm start
