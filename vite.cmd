@echo off
setlocal
set DIRNAME=%~dp0
node "%DIRNAME%node_modules\vite\bin\vite.js" --host :: --port 8080