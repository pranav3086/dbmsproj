@echo off
rem Double-click to run A10 Hospital (MySQL): starts MySQL, the API and the website.
rem Close this window or press Ctrl+C to stop.
cd /d "%~dp0"
start "" http://localhost:5173
npm start
